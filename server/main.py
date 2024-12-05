from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Routes
from routes.llm import llm

tags_metadata = [
  {
    "name": "llm",
    "description": "Gen-AI Model Routes for Conversations"
  },
  {
    "name": "default",
    "description": "API Health Matters...",
  },
]

app = FastAPI()

# CORS Policy Middleware
app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

@app.get("/", tags=["default"])
def root():
  return JSONResponse(content="server is live and running")

app.include_router(llm, tags=["llm"], prefix="/llm")