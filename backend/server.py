from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import logging
import uuid
import jwt
import bcrypt
import requests
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, UploadFile, File, Header, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ---------------------------------------------------------------------------
# App / DB setup
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("kopipos")

# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
JWT_ALGORITHM = "HS256"


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Belum login")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="Pengguna tidak ditemukan")
        user.pop("password_hash", None)
        user.pop("_id", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesi berakhir, silakan login kembali")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")


async def require_owner(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Hanya untuk Pemilik/Admin")
    return user


# ---------------------------------------------------------------------------
# Object storage helpers
# ---------------------------------------------------------------------------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "kopipos"
storage_key = None

MIME_TYPES = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
              "gif": "image/gif", "webp": "image/webp", "svg": "image/svg+xml"}


def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type},
                        data=data, timeout=120)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": key, "Content-Type": content_type},
                            data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AddonOption(BaseModel):
    name: str
    price: float = 0


class VariantOption(BaseModel):
    name: str
    price_delta: float = 0


class VariantGroup(BaseModel):
    name: str  # e.g. "Ukuran", "Suhu"
    options: List[VariantOption] = []


class Product(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    category: str
    price: float
    cost_price: float = 0
    stock: int = 0
    min_stock: int = 5
    unit: str = "pcs"
    sku: str = ""
    description: str = ""
    image_url: str = ""
    active: bool = True
    variant_groups: List[VariantGroup] = []
    addons: List[AddonOption] = []
    has_sweetness: bool = False
    has_ice: bool = False
    is_bestseller: bool = False
    created_at: str = Field(default_factory=now_iso)


class ProductCreate(BaseModel):
    name: str
    category: str
    price: float
    cost_price: float = 0
    stock: int = 0
    min_stock: int = 5
    unit: str = "pcs"
    sku: str = ""
    description: str = ""
    image_url: str = ""
    active: bool = True
    variant_groups: List[VariantGroup] = []
    addons: List[AddonOption] = []
    has_sweetness: bool = False
    has_ice: bool = False
    is_bestseller: bool = False


class CartItem(BaseModel):
    product_id: str
    name: str
    quantity: int
    unit_price: float  # base price
    variants: List[Dict[str, Any]] = []  # [{group, name, price_delta}]
    addons: List[Dict[str, Any]] = []     # [{name, price}]
    sweetness: str = ""
    ice: str = ""
    note: str = ""
    line_total: float = 0


class CheckoutRequest(BaseModel):
    items: List[CartItem]
    order_type: str = "dine_in"  # dine_in | takeaway
    customer_name: str = ""
    table_number: str = ""
    payment_method: str = "cash"  # cash | qris
    cash_received: float = 0
    discount_type: str = "amount"  # amount | percent
    discount_value: float = 0
    client_txn_id: str = ""  # idempotency key


class OrderStatusUpdate(BaseModel):
    status: str


class StockAdjustRequest(BaseModel):
    product_id: str
    type: str  # in | out | adjust
    quantity: int
    note: str = ""


class Settings(BaseModel):
    shop_name: str = "Yulia Kitchen"
    logo_url: str = ""
    address: str = ""
    phone: str = ""
    receipt_footer: str = "Terima kasih, sampai jumpa lagi di Yulia Kitchen!"
    qris_url: str = ""
    tax_enabled: bool = False
    tax_percent: float = 0
    service_enabled: bool = False
    service_percent: float = 0
    currency: str = "Rp"
    printer_size: str = "80mm"  # 58mm | 80mm


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------
def set_auth_cookie(response: Response, token: str):
    response.set_cookie(key="access_token", value=token, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")


@api_router.post("/auth/login")
async def login(body: LoginRequest, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email atau kata sandi salah")
    token = create_access_token(user["id"], user["email"], user["role"])
    set_auth_cookie(response, token)
    return {"access_token": token, "user": {"id": user["id"], "email": user["email"],
            "name": user["name"], "role": user["role"]}}


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"]}


# ---------------------------------------------------------------------------
# File upload
# ---------------------------------------------------------------------------
@api_router.post("/upload")
async def upload(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "png"
    content_type = MIME_TYPES.get(ext, file.content_type or "application/octet-stream")
    path = f"{APP_NAME}/uploads/{new_id()}.{ext}"
    data = await file.read()
    result = put_object(path, data, content_type)
    await db.files.insert_one({
        "id": new_id(), "storage_path": result["path"], "original_filename": file.filename,
        "content_type": content_type, "is_deleted": False, "created_at": now_iso(),
    })
    backend = os.environ.get("FRONTEND_URL", "")
    return {"url": f"/api/files/{result['path']}", "path": result["path"]}


@api_router.get("/files/{path:path}")
async def download_file(path: str):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="File tidak ditemukan")
    data, content_type = get_object(path)
    return Response(content=data, media_type=record.get("content_type", content_type))


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------
def stock_status(p: dict) -> str:
    if p["stock"] <= 0:
        return "habis"
    if p["stock"] <= p.get("min_stock", 5):
        return "menipis"
    return "tersedia"


def clean(doc: dict) -> dict:
    doc.pop("_id", None)
    if "stock" in doc:
        doc["stock_status"] = stock_status(doc)
    return doc


@api_router.get("/products")
async def list_products(user: dict = Depends(get_current_user)):
    products = await db.products.find({}).sort("name", 1).to_list(1000)
    return [clean(p) for p in products]


@api_router.post("/products")
async def create_product(body: ProductCreate, user: dict = Depends(require_owner)):
    product = Product(**body.model_dump())
    await db.products.insert_one(product.model_dump())
    return clean(product.model_dump())


@api_router.put("/products/{product_id}")
async def update_product(product_id: str, body: ProductCreate, user: dict = Depends(require_owner)):
    existing = await db.products.find_one({"id": product_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    update = body.model_dump()
    await db.products.update_one({"id": product_id}, {"$set": update})
    updated = await db.products.find_one({"id": product_id})
    return clean(updated)


@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, user: dict = Depends(require_owner)):
    await db.products.delete_one({"id": product_id})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Stock
# ---------------------------------------------------------------------------
@api_router.get("/stock/movements")
async def stock_movements(user: dict = Depends(get_current_user)):
    movements = await db.stock_movements.find({}).sort("created_at", -1).to_list(300)
    return [clean(m) for m in movements]


@api_router.post("/stock/adjust")
async def adjust_stock(body: StockAdjustRequest, user: dict = Depends(require_owner)):
    product = await db.products.find_one({"id": body.product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    before = product["stock"]
    if body.type == "in":
        after = before + abs(body.quantity)
    elif body.type == "out":
        after = before - abs(body.quantity)
        if after < 0:
            raise HTTPException(status_code=400, detail="Stok tidak boleh negatif")
    else:  # adjust -> set absolute
        after = abs(body.quantity)
    await db.products.update_one({"id": body.product_id}, {"$set": {"stock": after}})
    movement = {
        "id": new_id(), "product_id": body.product_id, "product_name": product["name"],
        "type": body.type, "quantity": body.quantity, "before": before, "after": after,
        "note": body.note, "user_name": user["name"], "created_at": now_iso(),
    }
    await db.stock_movements.insert_one(dict(movement))
    return clean(movement)


# ---------------------------------------------------------------------------
# Checkout / Transactions / Orders
# ---------------------------------------------------------------------------
def compute_line_total(item: CartItem) -> float:
    base = item.unit_price
    for v in item.variants:
        base += float(v.get("price_delta", 0))
    for a in item.addons:
        base += float(a.get("price", 0))
    return base * item.quantity


async def get_settings_doc() -> dict:
    s = await db.settings.find_one({"id": "shop"})
    if not s:
        s = Settings().model_dump()
        s["id"] = "shop"
        await db.settings.insert_one(dict(s))
    s.pop("_id", None)
    return s


@api_router.post("/checkout")
async def checkout(body: CheckoutRequest, user: dict = Depends(get_current_user)):
    if not body.items:
        raise HTTPException(status_code=400, detail="Keranjang kosong")

    # Idempotency: prevent duplicate submission
    if body.client_txn_id:
        existing = await db.transactions.find_one({"client_txn_id": body.client_txn_id})
        if existing:
            return clean(existing)

    # Validate stock & compute totals
    subtotal = 0.0
    cost_total = 0.0
    line_items = []
    for item in body.items:
        product = await db.products.find_one({"id": item.product_id})
        if not product:
            raise HTTPException(status_code=400, detail=f"Produk {item.name} tidak ditemukan")
        if not product.get("active", True):
            raise HTTPException(status_code=400, detail=f"{item.name} tidak tersedia")
        if product["stock"] < item.quantity:
            raise HTTPException(status_code=400, detail=f"Stok {item.name} tidak cukup")
        line_total = compute_line_total(item)
        subtotal += line_total
        cost_total += float(product.get("cost_price", 0)) * item.quantity
        li = item.model_dump()
        li["line_total"] = line_total
        line_items.append(li)

    settings = await get_settings_doc()
    # Discount applied on subtotal
    if body.discount_type == "percent":
        discount_amount = subtotal * min(max(body.discount_value, 0), 100) / 100
    else:
        discount_amount = min(max(body.discount_value, 0), subtotal)
    discount_amount = round(discount_amount)
    discounted = subtotal - discount_amount
    tax_amount = discounted * settings["tax_percent"] / 100 if settings.get("tax_enabled") else 0
    service_amount = discounted * settings["service_percent"] / 100 if settings.get("service_enabled") else 0
    total = round(discounted + tax_amount + service_amount)

    if body.payment_method == "cash" and body.cash_received < total:
        raise HTTPException(status_code=400, detail="Uang diterima kurang dari total")

    change = round(body.cash_received - total) if body.payment_method == "cash" else 0

    # Deduct stock + record movements
    for item in body.items:
        product = await db.products.find_one({"id": item.product_id})
        after = product["stock"] - item.quantity
        await db.products.update_one({"id": item.product_id}, {"$set": {"stock": after}})
        await db.stock_movements.insert_one({
            "id": new_id(), "product_id": item.product_id, "product_name": item.name,
            "type": "sale", "quantity": -item.quantity, "before": product["stock"], "after": after,
            "note": "Penjualan", "user_name": user["name"], "created_at": now_iso(),
        })

    # Transaction number
    count = await db.transactions.count_documents({})
    txn_number = f"TRX{datetime.now(timezone.utc).strftime('%y%m%d')}{count + 1:04d}"

    txn = {
        "id": new_id(), "txn_number": txn_number, "client_txn_id": body.client_txn_id,
        "items": line_items, "subtotal": subtotal, "discount_amount": discount_amount,
        "discount_type": body.discount_type, "discount_value": body.discount_value,
        "tax_amount": tax_amount, "service_amount": service_amount, "total": total,
        "cost_total": cost_total, "gross_profit": total - cost_total,
        "payment_method": body.payment_method,
        "cash_received": body.cash_received, "change": change, "status": "paid",
        "order_type": body.order_type, "customer_name": body.customer_name,
        "table_number": body.table_number, "cashier_name": user["name"],
        "cashier_id": user["id"], "created_at": now_iso(),
    }
    await db.transactions.insert_one(dict(txn))

    # Create linked order (kitchen)
    order = {
        "id": new_id(), "order_number": txn_number, "txn_id": txn["id"],
        "items": line_items, "total": total, "payment_method": body.payment_method,
        "payment_status": "paid", "order_status": "baru", "order_type": body.order_type,
        "customer_name": body.customer_name, "table_number": body.table_number,
        "cashier_name": user["name"], "created_at": now_iso(),
    }
    await db.orders.insert_one(dict(order))

    return clean(txn)


@api_router.get("/transactions")
async def list_transactions(user: dict = Depends(get_current_user),
                            period: str = Query("all"), start: str = Query(""),
                            end: str = Query(""), method: str = Query("all")):
    q: Dict[str, Any] = {}
    if period == "today":
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        q["created_at"] = {"$gte": today}
    elif period == "range" and start and end:
        q["created_at"] = {"$gte": start, "$lte": end + "T23:59:59"}
    if method in ("cash", "qris"):
        q["payment_method"] = method
    txns = await db.transactions.find(q).sort("created_at", -1).to_list(500)
    return [clean(t) for t in txns]


@api_router.get("/transactions/{txn_id}")
async def get_transaction(txn_id: str, user: dict = Depends(get_current_user)):
    t = await db.transactions.find_one({"id": txn_id})
    if not t:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    return clean(t)


@api_router.get("/orders")
async def list_orders(user: dict = Depends(get_current_user)):
    orders = await db.orders.find({}).sort("created_at", -1).to_list(300)
    return [clean(o) for o in orders]


@api_router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, body: OrderStatusUpdate, user: dict = Depends(get_current_user)):
    valid = ["baru", "diproses", "siap", "selesai", "dibatalkan"]
    if body.status not in valid:
        raise HTTPException(status_code=400, detail="Status tidak valid")
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    await db.orders.update_one({"id": order_id}, {"$set": {"order_status": body.status}})
    updated = await db.orders.find_one({"id": order_id})
    return clean(updated)


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------
@api_router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    return await get_settings_doc()


@api_router.put("/settings")
async def update_settings(body: Settings, user: dict = Depends(require_owner)):
    update = body.model_dump()
    update["id"] = "shop"
    await db.settings.update_one({"id": "shop"}, {"$set": update}, upsert=True)
    return await get_settings_doc()


# ---------------------------------------------------------------------------
# Reports / Dashboard
# ---------------------------------------------------------------------------
@api_router.get("/reports/dashboard")
async def dashboard(user: dict = Depends(require_owner)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    all_txns = await db.transactions.find({}).to_list(2000)

    today_txns = [t for t in all_txns if t["created_at"][:10] == today]
    today_sales = sum(t["total"] for t in today_txns)
    today_count = len(today_txns)
    products_sold = sum(sum(i["quantity"] for i in t["items"]) for t in today_txns)
    avg_txn = round(today_sales / today_count) if today_count else 0
    cash_sales = sum(t["total"] for t in today_txns if t["payment_method"] == "cash")
    qris_sales = sum(t["total"] for t in today_txns if t["payment_method"] == "qris")
    gross_profit = sum(t.get("gross_profit", 0) for t in today_txns)

    # Sales series - last 7 days
    daily = []
    for i in range(6, -1, -1):
        d = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
        s = sum(t["total"] for t in all_txns if t["created_at"][:10] == d)
        daily.append({"label": d[5:], "total": s})

    # Monthly - last 6 months
    monthly = []
    for i in range(5, -1, -1):
        month = (datetime.now(timezone.utc).replace(day=1) - timedelta(days=i * 30)).strftime("%Y-%m")
        s = sum(t["total"] for t in all_txns if t["created_at"][:7] == month)
        monthly.append({"label": month, "total": s})

    # Best sellers
    product_counts: Dict[str, int] = {}
    category_counts: Dict[str, float] = {}
    for t in all_txns:
        for i in t["items"]:
            product_counts[i["name"]] = product_counts.get(i["name"], 0) + i["quantity"]
    products = await db.products.find({}).to_list(1000)
    prod_cat = {p["name"]: p["category"] for p in products}
    for t in all_txns:
        for i in t["items"]:
            cat = prod_cat.get(i["name"], "Lainnya")
            category_counts[cat] = category_counts.get(cat, 0) + i["line_total"]
    best_products = sorted(product_counts.items(), key=lambda x: -x[1])[:5]
    best_categories = sorted(category_counts.items(), key=lambda x: -x[1])[:6]

    low_stock = [clean(p) for p in products if p["stock"] <= p.get("min_stock", 5)]
    recent = [clean(t) for t in sorted(all_txns, key=lambda x: x["created_at"], reverse=True)[:8]]

    return {
        "today_sales": today_sales, "today_count": today_count, "products_sold": products_sold,
        "avg_txn": avg_txn, "cash_sales": cash_sales, "qris_sales": qris_sales,
        "gross_profit": gross_profit, "daily": daily, "monthly": monthly,
        "best_products": [{"name": n, "qty": q} for n, q in best_products],
        "best_categories": [{"name": n, "total": round(v)} for n, v in best_categories],
        "low_stock": low_stock, "recent": recent,
    }


# ---------------------------------------------------------------------------
# Seed
# ---------------------------------------------------------------------------
async def seed():
    # Users
    for email_key, pass_key, name, role in [
        ("ADMIN_EMAIL", "ADMIN_PASSWORD", "Pemilik", "owner"),
        ("CASHIER_EMAIL", "CASHIER_PASSWORD", "Kasir", "cashier"),
    ]:
        email = os.environ.get(email_key, "").lower()
        pwd = os.environ.get(pass_key, "")
        existing = await db.users.find_one({"email": email})
        if not existing:
            await db.users.insert_one({"id": new_id(), "email": email, "name": name,
                                       "role": role, "password_hash": hash_password(pwd),
                                       "created_at": now_iso()})
        elif not verify_password(pwd, existing["password_hash"]):
            await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(pwd)}})

    await get_settings_doc()

    if await db.products.count_documents({}) > 0:
        return

    img = {
        "mojito_lime": "https://images.pexels.com/photos/33129959/pexels-photo-33129959.jpeg?auto=compress&cs=tinysrgb&w=600",
        "mojito_glass": "https://images.unsplash.com/photo-1568608275764-7a16d7fdfc56?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
        "mojito_sparkle": "https://images.pexels.com/photos/36268523/pexels-photo-36268523.jpeg?auto=compress&cs=tinysrgb&w=600",
        "mojito_pour": "https://images.unsplash.com/photo-1631067451074-27e2826ec83b?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
        "teh_manis": "https://images.unsplash.com/photo-1601390395693-364c0e22031a?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
        "teh_lemon": "https://images.pexels.com/photos/37105558/pexels-photo-37105558.jpeg?auto=compress&cs=tinysrgb&w=600",
        "teh_leci": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
        "jus_jeruk": "https://images.unsplash.com/photo-1618881158808-8a20f18d516e?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
        "jus_mangga": "https://images.unsplash.com/photo-1622597467821-df79dcb4f94d?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
        "jus_stroberi": "https://images.pexels.com/photos/2479242/pexels-photo-2479242.jpeg?auto=compress&cs=tinysrgb&w=600",
        "kelapa": "https://images.pexels.com/photos/12580173/pexels-photo-12580173.jpeg?auto=compress&cs=tinysrgb&w=600",
        "lemon_water": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
        "nasi_goreng": "https://images.pexels.com/photos/37171028/pexels-photo-37171028.jpeg?auto=compress&cs=tinysrgb&w=600",
        "ayam_geprek": "https://images.unsplash.com/photo-1681378128359-a5c2492a3535?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
        "mie_goreng": "https://images.pexels.com/photos/13294535/pexels-photo-13294535.jpeg?auto=compress&cs=tinysrgb&w=600",
        "breakfast": "https://images.pexels.com/photos/19834039/pexels-photo-19834039.jpeg?auto=compress&cs=tinysrgb&w=600",
        "croffle": "https://images.unsplash.com/photo-1611506168759-1e69a83b5a53?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
    }

    ukuran = VariantGroup(name="Ukuran", options=[VariantOption(name="Regular"), VariantOption(name="Large", price_delta=5000)])
    addon_drink = [AddonOption(name="Extra Boba", price=5000), AddonOption(name="Extra Jelly", price=4000), AddonOption(name="Extra Nata", price=4000), AddonOption(name="Extra Syrup", price=3000)]
    addon_makan = [AddonOption(name="Extra Nasi", price=5000), AddonOption(name="Extra Keju", price=6000), AddonOption(name="Extra Sambal", price=2000)]

    def P(**kw):
        return Product(**kw).model_dump()

    products = [
        P(name="Mojito Lemon", category="Mojito", price=18000, cost_price=6000, stock=50, unit="gelas",
          sku="MOJ001", image_url=img["mojito_glass"], has_ice=True, variant_groups=[ukuran], addons=addon_drink, is_bestseller=True),
        P(name="Mojito Strawberry", category="Mojito", price=20000, cost_price=7000, stock=45, unit="gelas",
          sku="MOJ002", image_url=img["mojito_lime"], has_ice=True, variant_groups=[ukuran], addons=addon_drink, is_bestseller=True),
        P(name="Mojito Leci", category="Mojito", price=20000, cost_price=7000, stock=40, unit="gelas",
          sku="MOJ003", image_url=img["mojito_pour"], has_ice=True, variant_groups=[ukuran], addons=addon_drink),
        P(name="Mojito Blue Ocean", category="Mojito", price=20000, cost_price=7000, stock=40, unit="gelas",
          sku="MOJ004", image_url=img["mojito_sparkle"], has_ice=True, variant_groups=[ukuran], addons=addon_drink),
        P(name="Es Teh Manis", category="Es Teh", price=5000, cost_price=1500, stock=100, unit="gelas",
          sku="TEH001", image_url=img["teh_manis"], has_sweetness=True, has_ice=True, variant_groups=[ukuran], is_bestseller=True),
        P(name="Es Teh Lemon", category="Es Teh", price=10000, cost_price=3000, stock=70, unit="gelas",
          sku="TEH002", image_url=img["teh_lemon"], has_sweetness=True, has_ice=True, variant_groups=[ukuran]),
        P(name="Es Teh Leci", category="Es Teh", price=12000, cost_price=4000, stock=60, unit="gelas",
          sku="TEH003", image_url=img["teh_leci"], has_sweetness=True, has_ice=True, variant_groups=[ukuran], addons=[AddonOption(name="Extra Jelly", price=4000)]),
        P(name="Jus Jeruk", category="Jus", price=12000, cost_price=4000, stock=50, unit="gelas",
          sku="JUS001", image_url=img["jus_jeruk"], has_sweetness=True, has_ice=True, variant_groups=[ukuran]),
        P(name="Jus Mangga", category="Jus", price=13000, cost_price=4500, stock=45, unit="gelas",
          sku="JUS002", image_url=img["jus_mangga"], has_sweetness=True, has_ice=True, variant_groups=[ukuran]),
        P(name="Jus Stroberi", category="Jus", price=15000, cost_price=5000, stock=35, unit="gelas",
          sku="JUS003", image_url=img["jus_stroberi"], has_sweetness=True, has_ice=True, variant_groups=[ukuran]),
        P(name="Es Kelapa Muda", category="Minuman", price=15000, cost_price=6000, stock=30, unit="gelas",
          sku="MIN001", image_url=img["kelapa"], has_sweetness=True, has_ice=True, is_bestseller=True),
        P(name="Es Jeruk Nipis", category="Minuman", price=10000, cost_price=3000, stock=4, min_stock=5, unit="gelas",
          sku="MIN002", image_url=img["lemon_water"], has_sweetness=True, has_ice=True),
        P(name="Nasi Goreng", category="Makanan", price=18000, cost_price=8000, stock=30, unit="porsi",
          sku="MAK001", image_url=img["nasi_goreng"], addons=addon_makan),
        P(name="Mie Goreng", category="Makanan", price=15000, cost_price=7000, stock=25, unit="porsi",
          sku="MAK002", image_url=img["mie_goreng"], addons=addon_makan),
        P(name="Ayam Geprek", category="Makanan", price=20000, cost_price=10000, stock=20, unit="porsi",
          sku="MAK003", image_url=img["ayam_geprek"], addons=addon_makan),
        P(name="Nasi Ayam", category="Makanan", price=22000, cost_price=11000, stock=18, unit="porsi",
          sku="MAK004", image_url=img["breakfast"], addons=addon_makan),
        P(name="Croffle Coklat", category="Dessert", price=18000, cost_price=7000, stock=15, unit="pcs",
          sku="DST001", image_url=img["croffle"], addons=[AddonOption(name="Extra Topping", price=5000)]),
        P(name="Paket Hemat Nasi + Es Teh", category="Paket", price=22000, cost_price=9000, stock=30, unit="paket",
          sku="PKT001", image_url=img["nasi_goreng"]),
    ]
    await db.products.insert_many(products)
    logger.info("Seeded %d products", len(products))


@app.on_event("startup")
async def startup():
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    await db.users.create_index("email", unique=True)
    await db.products.create_index("id")
    await db.transactions.create_index("client_txn_id")
    await seed()

    # Write test credentials
    creds = Path("/app/memory/test_credentials.md")
    creds.write_text(
        "# Test Credentials\n\n"
        "## Owner / Admin\n"
        f"- Email: {os.environ.get('ADMIN_EMAIL')}\n"
        f"- Password: {os.environ.get('ADMIN_PASSWORD')}\n"
        "- Role: owner (full access)\n\n"
        "## Cashier / Kasir\n"
        f"- Email: {os.environ.get('CASHIER_EMAIL')}\n"
        f"- Password: {os.environ.get('CASHIER_PASSWORD')}\n"
        "- Role: cashier (Kasir, Pesanan, Riwayat only)\n\n"
        "## Auth endpoints\n"
        "- POST /api/auth/login {email, password}\n"
        "- GET /api/auth/me\n"
        "- POST /api/auth/logout\n"
    )


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000"), "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)
