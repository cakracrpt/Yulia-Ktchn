"""Backend integration tests for KopiPOS."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()
API = BASE_URL.rstrip("/") + "/api"

OWNER = {"email": "owner@kopipos.id", "password": "owner123"}
CASHIER = {"email": "kasir@kopipos.id", "password": "kasir123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def owner_token():
    return _login(OWNER)


@pytest.fixture(scope="session")
def cashier_token():
    return _login(CASHIER)


def H(t):
    return {"Authorization": f"Bearer {t}"}


# ---------- Auth ----------
class TestAuth:
    def test_login_owner(self):
        r = requests.post(f"{API}/auth/login", json=OWNER)
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["role"] == "owner"
        assert data["access_token"]

    def test_login_cashier(self):
        r = requests.post(f"{API}/auth/login", json=CASHIER)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "cashier"

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "owner@kopipos.id", "password": "wrong"})
        assert r.status_code == 401

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_owner(self, owner_token):
        r = requests.get(f"{API}/auth/me", headers=H(owner_token))
        assert r.status_code == 200
        assert r.json()["role"] == "owner"


# ---------- Products ----------
class TestProducts:
    def test_list_products(self, cashier_token):
        r = requests.get(f"{API}/products", headers=H(cashier_token))
        assert r.status_code == 200
        products = r.json()
        assert len(products) >= 13
        assert all("_id" not in p for p in products)
        assert all("stock_status" in p for p in products)

    def test_cashier_cannot_create(self, cashier_token):
        r = requests.post(f"{API}/products", headers=H(cashier_token),
                          json={"name": "TEST_x", "category": "Kopi", "price": 1000})
        assert r.status_code == 403

    def test_owner_crud(self, owner_token):
        payload = {"name": "TEST_Prod", "category": "Kopi", "price": 12345, "stock": 5}
        r = requests.post(f"{API}/products", headers=H(owner_token), json=payload)
        assert r.status_code == 200
        pid = r.json()["id"]
        assert r.json()["name"] == "TEST_Prod"
        # update
        r = requests.put(f"{API}/products/{pid}", headers=H(owner_token),
                         json={**payload, "price": 20000})
        assert r.status_code == 200
        assert r.json()["price"] == 20000
        # delete
        r = requests.delete(f"{API}/products/{pid}", headers=H(owner_token))
        assert r.status_code == 200


# ---------- Stock ----------
class TestStock:
    def test_adjust_in_out(self, owner_token):
        products = requests.get(f"{API}/products", headers=H(owner_token)).json()
        p = products[0]
        pid = p["id"]
        before = p["stock"]
        r = requests.post(f"{API}/stock/adjust", headers=H(owner_token),
                          json={"product_id": pid, "type": "in", "quantity": 3})
        assert r.status_code == 200
        assert r.json()["after"] == before + 3
        r = requests.post(f"{API}/stock/adjust", headers=H(owner_token),
                          json={"product_id": pid, "type": "out", "quantity": 3})
        assert r.status_code == 200
        assert r.json()["after"] == before

    def test_cannot_negative(self, owner_token):
        products = requests.get(f"{API}/products", headers=H(owner_token)).json()
        pid = products[0]["id"]
        r = requests.post(f"{API}/stock/adjust", headers=H(owner_token),
                          json={"product_id": pid, "type": "out", "quantity": 99999})
        assert r.status_code == 400

    def test_cashier_cannot_adjust(self, cashier_token, owner_token):
        products = requests.get(f"{API}/products", headers=H(owner_token)).json()
        r = requests.post(f"{API}/stock/adjust", headers=H(cashier_token),
                          json={"product_id": products[0]["id"], "type": "in", "quantity": 1})
        assert r.status_code == 403

    def test_movements(self, owner_token):
        r = requests.get(f"{API}/stock/movements", headers=H(owner_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Checkout / Transactions ----------
class TestCheckout:
    def _cart(self, product):
        return {
            "product_id": product["id"], "name": product["name"], "quantity": 1,
            "unit_price": product["price"], "variants": [], "addons": [],
        }

    def test_checkout_cash(self, cashier_token):
        products = requests.get(f"{API}/products", headers=H(cashier_token)).json()
        p = next(x for x in products if x["stock"] > 5 and not x.get("variant_groups"))
        stock_before = p["stock"]
        body = {"items": [self._cart(p)], "payment_method": "cash",
                "cash_received": p["price"] + 10000, "client_txn_id": str(uuid.uuid4())}
        r = requests.post(f"{API}/checkout", headers=H(cashier_token), json=body)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["total"] == p["price"]
        assert d["change"] == 10000
        assert d["txn_number"].startswith("TRX")
        # stock deducted
        p2 = [x for x in requests.get(f"{API}/products", headers=H(cashier_token)).json() if x["id"] == p["id"]][0]
        assert p2["stock"] == stock_before - 1

    def test_insufficient_cash(self, cashier_token):
        products = requests.get(f"{API}/products", headers=H(cashier_token)).json()
        p = next(x for x in products if x["stock"] > 0)
        body = {"items": [self._cart(p)], "payment_method": "cash",
                "cash_received": 1, "client_txn_id": str(uuid.uuid4())}
        r = requests.post(f"{API}/checkout", headers=H(cashier_token), json=body)
        assert r.status_code == 400

    def test_idempotency(self, cashier_token):
        products = requests.get(f"{API}/products", headers=H(cashier_token)).json()
        p = next(x for x in products if x["stock"] > 5 and not x.get("variant_groups"))
        cid = str(uuid.uuid4())
        body = {"items": [self._cart(p)], "payment_method": "qris",
                "cash_received": 0, "client_txn_id": cid}
        r1 = requests.post(f"{API}/checkout", headers=H(cashier_token), json=body)
        r2 = requests.post(f"{API}/checkout", headers=H(cashier_token), json=body)
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json()["id"] == r2.json()["id"]

    def test_empty_cart(self, cashier_token):
        r = requests.post(f"{API}/checkout", headers=H(cashier_token),
                          json={"items": [], "payment_method": "cash"})
        assert r.status_code == 400

    def test_list_transactions(self, cashier_token):
        r = requests.get(f"{API}/transactions", headers=H(cashier_token))
        assert r.status_code == 200
        r2 = requests.get(f"{API}/transactions?period=today&method=cash", headers=H(cashier_token))
        assert r2.status_code == 200


# ---------- Orders ----------
class TestOrders:
    def test_orders_and_status_flow(self, cashier_token):
        orders = requests.get(f"{API}/orders", headers=H(cashier_token)).json()
        assert isinstance(orders, list)
        if not orders:
            pytest.skip("no orders yet")
        oid = orders[0]["id"]
        for status in ["diproses", "siap", "selesai"]:
            r = requests.put(f"{API}/orders/{oid}/status", headers=H(cashier_token),
                             json={"status": status})
            assert r.status_code == 200
            assert r.json()["order_status"] == status

    def test_invalid_status(self, cashier_token):
        orders = requests.get(f"{API}/orders", headers=H(cashier_token)).json()
        if not orders:
            pytest.skip("no orders")
        r = requests.put(f"{API}/orders/{orders[0]['id']}/status", headers=H(cashier_token),
                         json={"status": "bogus"})
        assert r.status_code == 400


# ---------- Settings ----------
class TestSettings:
    def test_get_settings(self, cashier_token):
        r = requests.get(f"{API}/settings", headers=H(cashier_token))
        assert r.status_code == 200
        assert "shop_name" in r.json()

    def test_update_settings_owner(self, owner_token):
        original = requests.get(f"{API}/settings", headers=H(owner_token)).json()
        original.pop("_id", None)
        payload = {**original, "shop_name": "KopiPOS TEST", "tax_enabled": True, "tax_percent": 10}
        r = requests.put(f"{API}/settings", headers=H(owner_token), json=payload)
        assert r.status_code == 200
        assert r.json()["shop_name"] == "KopiPOS TEST"
        assert r.json()["tax_enabled"] is True
        # revert
        requests.put(f"{API}/settings", headers=H(owner_token),
                     json={**original, "shop_name": original.get("shop_name", "KopiPOS")})

    def test_cashier_cannot_update_settings(self, cashier_token):
        r = requests.put(f"{API}/settings", headers=H(cashier_token),
                         json={"shop_name": "x"})
        assert r.status_code == 403


# ---------- Reports ----------
class TestReports:
    def test_dashboard_owner(self, owner_token):
        r = requests.get(f"{API}/reports/dashboard", headers=H(owner_token))
        assert r.status_code == 200
        d = r.json()
        for k in ("today_sales", "today_count", "daily", "monthly", "best_products", "low_stock"):
            assert k in d
        assert len(d["daily"]) == 7

    def test_dashboard_cashier_forbidden(self, cashier_token):
        r = requests.get(f"{API}/reports/dashboard", headers=H(cashier_token))
        assert r.status_code == 403
