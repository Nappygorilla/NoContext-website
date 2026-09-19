from __future__ import annotations
import hashlib,hmac,os,secrets,time
from datetime import datetime,timedelta,timezone
from email_validator import EmailNotValidError,validate_email
from fastapi import FastAPI,HTTPException,Request,Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel,Field
from sqlalchemy import DateTime,Integer,String,create_engine,select,text
from sqlalchemy.orm import DeclarativeBase,Mapped,Session,mapped_column
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError,VerificationError
ENVIRONMENT=os.getenv("ENVIRONMENT","development").strip().lower()
RAW_DATABASE_URL=os.getenv("DATABASE_URL","").strip()
if ENVIRONMENT=="production" and not RAW_DATABASE_URL: raise RuntimeError("DATABASE_URL is required in production")
DATABASE_URL=RAW_DATABASE_URL or "sqlite:///./nocontext.db"
if DATABASE_URL.startswith("postgresql://"): DATABASE_URL="postgresql+psycopg://"+DATABASE_URL[len("postgresql://"):]
elif DATABASE_URL.startswith("postgres://"): DATABASE_URL="postgresql+psycopg://"+DATABASE_URL[len("postgres://"):]
FRONTEND_ORIGIN=os.getenv("FRONTEND_ORIGIN","https://nappygorilla.github.io").rstrip("/")
SESSION_TTL_DAYS=int(os.getenv("SESSION_TTL_DAYS","30"));LICENSE_TTL_DAYS=int(os.getenv("LICENSE_TTL_DAYS","30"));SESSION_COOKIE="__Host-nocontext_session";CSRF_COOKIE="nocontext_csrf"
CSRF_SECRET=os.getenv("CSRF_SECRET","").strip()
if len(CSRF_SECRET)<32:
    CSRF_SECRET=hashlib.sha256(("NoContext CSRF secret:"+DATABASE_URL).encode("utf-8")).hexdigest()
connect_args={"check_same_thread":False} if DATABASE_URL.startswith("sqlite") else {}
engine=create_engine(DATABASE_URL,pool_pre_ping=True,connect_args=connect_args)
class Base(DeclarativeBase): pass
class User(Base):
    __tablename__="users";id:Mapped[int]=mapped_column(Integer,primary_key=True);username:Mapped[str]=mapped_column(String(32),unique=True,index=True);email:Mapped[str]=mapped_column(String(320),unique=True,index=True);password_hash:Mapped[str]=mapped_column(String(512));created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=lambda:datetime.now(timezone.utc))
class SessionRecord(Base):
    __tablename__="sessions";id:Mapped[int]=mapped_column(Integer,primary_key=True);token_hash:Mapped[str]=mapped_column(String(64),unique=True,index=True);csrf_hash:Mapped[str]=mapped_column(String(64));user_id:Mapped[int]=mapped_column(Integer,index=True);expires_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),index=True)
class RateLimit(Base):
    __tablename__="rate_limits";key:Mapped[str]=mapped_column(String(128),primary_key=True);window_started:Mapped[int]=mapped_column(Integer);attempts:Mapped[int]=mapped_column(Integer,default=0)
class License(Base):
    __tablename__="licenses";id:Mapped[int]=mapped_column(Integer,primary_key=True);key_hash:Mapped[str]=mapped_column(String(64),unique=True,index=True);key_prefix:Mapped[str]=mapped_column(String(24),index=True);user_id:Mapped[int]=mapped_column(Integer,index=True);product:Mapped[str]=mapped_column(String(64),default="Luna.win External");status:Mapped[str]=mapped_column(String(16),default="active",index=True);created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=lambda:datetime.now(timezone.utc));expires_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),index=True);activated_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True),nullable=True);last_seen_at:Mapped[datetime|None]=mapped_column(DateTime(timezone=True),nullable=True)
Base.metadata.create_all(engine);password_hasher=PasswordHasher(time_cost=2,memory_cost=19456,parallelism=1)
app=FastAPI(title="luna.win API",version="1.3.6",docs_url=None,redoc_url=None)
app.add_middleware(CORSMiddleware,allow_origins=[FRONTEND_ORIGIN],allow_credentials=True,allow_methods=["GET","POST","OPTIONS"],allow_headers=["Content-Type","X-CSRF-Token","X-Discord-Bot-Secret","X-Luna-API-Key"])
RESERVED_USERNAMES={"rootadmin","root-admin","root_admin","rootadministrator","root-administrator","root_administrator","root","admin","administrator","administratoraccount","system","superadmin","super-admin","super_admin","owner","support","staff","moderator","mod","security","securityadmin","security-admin","security_admin","nocontext","nocontextadmin","nocontext-admin","nocontext_admin"}
def username_key(value:str)->str:return "".join(ch for ch in value.strip().lower() if ch.isalnum())
def validate_username(value:str)->str:
    username=value.strip()
    if username_key(username) in {username_key(x) for x in RESERVED_USERNAMES}: raise HTTPException(status_code=400,detail="That username is reserved.")
    return username
class RegisterBody(BaseModel): username:str=Field(min_length=3,max_length=32,pattern=r"^[A-Za-z0-9_]+$");email:str=Field(min_length=3,max_length=320);password:str=Field(min_length=12,max_length=128)
class LoginBody(BaseModel): email:str=Field(min_length=3,max_length=320);password:str=Field(min_length=1,max_length=128)
class ChangeUsernameBody(BaseModel): username:str=Field(min_length=3,max_length=32,pattern=r"^[A-Za-z0-9_]+$");current_password:str=Field(min_length=1,max_length=128)
class LicenseGenerateBody(BaseModel): product:str=Field(default="Luna.win External",min_length=1,max_length=64)
class LicenseValidateBody(BaseModel): key:str=Field(min_length=16,max_length=128);product:str=Field(default="Luna.win External",min_length=1,max_length=64)
def now(): return datetime.now(timezone.utc)
def utc_datetime(value): return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
def normalize_email(value):
    try:return validate_email(value.strip(),check_deliverability=False).normalized.lower()
    except EmailNotValidError as exc:raise HTTPException(status_code=400,detail="Enter a valid email address.") from exc
def token_hash(token): return hashlib.sha256(token.encode()).hexdigest()
def csrf_for_session(raw_session):
    return hmac.new(CSRF_SECRET.encode("utf-8"),raw_session.encode("utf-8"),hashlib.sha256).hexdigest()
def new_token(): return secrets.token_urlsafe(32)
def new_license_key(): return "LUNA-"+"-".join(secrets.token_hex(4).upper() for _ in range(4))
def client_ip(request): return request.headers.get("CF-Connecting-IP") or (request.client.host if request.client else "unknown")
def enforce_origin(request):
    origin=request.headers.get("Origin")
    if origin and origin.rstrip("/")!=FRONTEND_ORIGIN: raise HTTPException(status_code=403,detail="Origin not allowed.")
def rate_limit(request,bucket,limit,window=900):
    key=f"{bucket}:{client_ip(request)}";current=int(time.time())
    with Session(engine) as db:
        row=db.get(RateLimit,key)
        if row is None or current-row.window_started>=window:
            if row is None:db.add(RateLimit(key=key,window_started=current,attempts=1))
            else:row.window_started=current;row.attempts=1
        else:
            row.attempts+=1
            if row.attempts>limit:db.commit();raise HTTPException(status_code=429,detail="Too many attempts. Try again later.")
        db.commit()
def session_from_token(raw):
    if not raw or len(raw)>256:return None
    with Session(engine) as db:
        record=db.scalar(select(SessionRecord).where(SessionRecord.token_hash==token_hash(raw)))
        if not record or utc_datetime(record.expires_at)<=now():return None
        user=db.get(User,record.user_id)
        if not user:return None
        db.expunge(record);db.expunge(user);return record,user
def session_from_request(request): return session_from_token(request.cookies.get(SESSION_COOKIE))
def clear_csrf_cookie(response): response.delete_cookie(CSRF_COOKIE,secure=True,httponly=False,samesite="none",path="/")
def set_session(response,user_id):
    raw_session=new_token();raw_csrf=csrf_for_session(raw_session);expires=now()+timedelta(days=SESSION_TTL_DAYS)
    with Session(engine) as db:db.add(SessionRecord(token_hash=token_hash(raw_session),csrf_hash=token_hash(raw_csrf),user_id=user_id,expires_at=expires));db.commit()
    response.set_cookie(SESSION_COOKIE,raw_session,max_age=SESSION_TTL_DAYS*86400,expires=expires,secure=True,httponly=True,samesite="none",path="/")
    clear_csrf_cookie(response)
    return raw_csrf,expires
def require_csrf(request):
    enforce_origin(request)
    raw_session=request.cookies.get(SESSION_COOKIE,"")
    auth=session_from_token(raw_session)
    if not auth:raise HTTPException(status_code=401,detail="Not signed in.")
    record,user=auth;provided=request.headers.get("X-CSRF-Token","")
    deterministic=csrf_for_session(raw_session) if raw_session else ""
    deterministic_valid=bool(provided) and hmac.compare_digest(provided,deterministic)
    legacy_valid=bool(provided) and hmac.compare_digest(token_hash(provided),record.csrf_hash)
    if not (deterministic_valid or legacy_valid):raise HTTPException(status_code=403,detail="Invalid CSRF token.")
    return record,user
@app.get("/")
def root():return {"service":"luna.win API","status":"ok"}
@app.get("/api/health")
def health():
    with engine.connect() as conn:conn.execute(text("SELECT 1"))
    return {"status":"ok"}
@app.post("/api/auth/register",status_code=201)
def register(body:RegisterBody,request:Request,response:Response):
    enforce_origin(request);rate_limit(request,"register",8);email=normalize_email(body.email);username=validate_username(body.username)
    with Session(engine) as db:
        if db.scalar(select(User).where((User.email==email)|(User.username==username))):raise HTTPException(status_code=409,detail="That account information is already in use.")
        user=User(username=username,email=email,password_hash=password_hasher.hash(body.password));db.add(user);db.commit();db.refresh(user);data={"id":user.id,"username":user.username,"email":user.email}
    csrf,expires=set_session(response,data["id"]);return {"user":data,"csrfToken":csrf,"sessionExpiresAt":expires.isoformat()}
@app.post("/api/auth/login")
def login(body:LoginBody,request:Request,response:Response):
    enforce_origin(request);rate_limit(request,"login",10);email=normalize_email(body.email)
    with Session(engine) as db:
        user=db.scalar(select(User).where(User.email==email));valid=False
        if user:
            try:valid=password_hasher.verify(user.password_hash,body.password)
            except (VerifyMismatchError,VerificationError):valid=False
        if not user or not valid:raise HTTPException(status_code=401,detail="Invalid email or password.")
        data={"id":user.id,"username":user.username,"email":user.email}
    csrf,expires=set_session(response,data["id"]);return {"user":data,"csrfToken":csrf,"sessionExpiresAt":expires.isoformat()}
@app.post("/api/auth/change-username")
def change_username(body:ChangeUsernameBody,request:Request):
    _,user=require_csrf(request)
    rate_limit(request,"change-username",5)
    username=validate_username(body.username)
    try:
        password_valid=password_hasher.verify(user.password_hash,body.current_password)
    except (VerifyMismatchError,VerificationError):
        password_valid=False
    if not password_valid:
        raise HTTPException(status_code=401,detail="Current password is incorrect.")
    if username == user.username:
        return {"success":True,"user":{"id":user.id,"username":user.username,"email":user.email},"message":"Username is already set to that name."}
    with Session(engine) as db:
        current=db.get(User,user.id)
        if not current:
            raise HTTPException(status_code=401,detail="Account not found.")
        duplicate=db.scalar(select(User).where(User.username==username,User.id!=user.id))
        if duplicate:
            raise HTTPException(status_code=409,detail="That username is already in use.")
        current.username=username
        db.commit()
        db.refresh(current)
        data={"id":current.id,"username":current.username,"email":current.email}
    return {"success":True,"user":data,"message":"Username updated."}

@app.get("/api/auth/me")
def me(request:Request):
    raw_session=request.cookies.get(SESSION_COOKIE,"")
    auth=session_from_token(raw_session)
    if not auth:return {"authenticated":False}
    record,user=auth
    return {"authenticated":True,"user":{"id":user.id,"username":user.username,"email":user.email},"csrfToken":csrf_for_session(raw_session),"sessionExpiresAt":utc_datetime(record.expires_at).isoformat()}
@app.post("/api/auth/logout")
def logout(request:Request,response:Response):
    record,_=require_csrf(request)
    with Session(engine) as db:db.delete(db.get(SessionRecord,record.id));db.commit()
    response.delete_cookie(SESSION_COOKIE,secure=True,httponly=True,samesite="none",path="/");clear_csrf_cookie(response);response.headers["Clear-Site-Data"]='"cache", "storage"';return {"success":True}
@app.post("/api/licenses/generate",status_code=201)
def generate_license(body:LicenseGenerateBody,request:Request):
    _,user=require_csrf(request);rate_limit(request,"license-generate",5);plain_key=new_license_key();expires=now()+timedelta(days=LICENSE_TTL_DAYS)
    with Session(engine) as db:db.add(License(key_hash=token_hash(plain_key),key_prefix=plain_key[:11],user_id=user.id,product=body.product.strip(),status="active",expires_at=expires));db.commit()
    return {"key":plain_key,"product":body.product.strip(),"expiresAt":expires.isoformat()}
@app.get("/api/licenses")
def list_licenses(request:Request):
    _,user=require_csrf(request)
    with Session(engine) as db:
        licenses=db.scalars(select(License).where(License.user_id==user.id).order_by(License.created_at.desc())).all()
        return {"licenses":[{"keyPrefix":x.key_prefix,"product":x.product,"status":x.status,"createdAt":utc_datetime(x.created_at).isoformat(),"expiresAt":utc_datetime(x.expires_at).isoformat()} for x in licenses]}
@app.post("/api/licenses/validate")
def validate_license(body:LicenseValidateBody,request:Request):
    enforce_origin(request)
    with Session(engine) as db:
        license=db.scalar(select(License).where(License.key_hash==token_hash(body.key)))
        if not license or license.product!=body.product.strip():raise HTTPException(status_code=404,detail="License not found.")
        current=now();expires=utc_datetime(license.expires_at)
        if license.status!="active" or expires<=current:
            if license.status=="active":license.status="expired";db.commit()
            raise HTTPException(status_code=403,detail="License is expired or inactive.")
        license.last_seen_at=current
        if license.activated_at is None:license.activated_at=current
        db.commit();return {"valid":True,"product":license.product,"expiresAt":expires.isoformat()}
from app.audit_routes import register_audit_routes, record_audit
from app.ticket_routes import register_ticket_routes
from app.cheat_routes import register_cheat_routes
from app.key_routes import register_key_routes
from app.workink_callback import register_workink_callback
from app.discord_auth_routes import register_discord_auth_routes
from app.password_reset_routes import register_password_reset_routes
from app.developer_api_routes import register_developer_api_routes
from app.bot_command_routes import register_bot_command_routes
from app.key_repo_sync import start_license_repo_sync
from app.lifetime_keys import ensure_lifetime_keys
from app.media_routes import register_media_routes
register_audit_routes(app,engine,session_from_request)
register_ticket_routes(app,engine,require_csrf,session_from_request,enforce_origin,rate_limit,User)
register_cheat_routes(app,engine,session_from_request,require_csrf)
register_key_routes(app,engine,require_csrf,session_from_request,User)
register_workink_callback(app,engine,session_from_request)
register_discord_auth_routes(app,engine,set_session,User)
register_password_reset_routes(app,engine,User,rate_limit,record_audit)
register_developer_api_routes(app,engine,session_from_request,require_csrf,User,rate_limit,record_audit)
register_media_routes(app,engine,session_from_request,require_csrf)
register_bot_command_routes(app,engine,User,record_audit)
if os.getenv("NOCONTEXT_DISABLE_LIFETIME_KEYS", "").strip() != "1":
    ensure_lifetime_keys(engine)

def cleanup_malformed_key_hashes():
    # A SHA-256 key hash must be 64 hexadecimal characters. Any value beginning
    # with "NC-" is an old/malformed stored hash, not a valid SHA-256 digest.
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM free_keys WHERE key_hash LIKE 'NC-%'"))
        conn.execute(text("DELETE FROM licenses WHERE key_hash LIKE 'NC-%'"))


start_license_repo_sync(engine,app)
