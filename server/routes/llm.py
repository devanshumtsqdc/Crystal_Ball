from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.AI.llm_service import run_crystal_ball_assistant
from langchain.memory import ConversationBufferMemory
import base64
import asyncio
from gtts import gTTS
from io import BytesIO

llm = APIRouter()

# Existing WebSocket manager class
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

    async def send_voice_message(self, audio_data: bytes, websocket: WebSocket):
        # Send audio data as base64-encoded string
        await websocket.send_text(audio_data)

manager = ConnectionManager()
conversation_memory = {}

@llm.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: int):
    await manager.connect(websocket)
    if client_id not in conversation_memory:
        conversation_memory[client_id] = ConversationBufferMemory(memory_key="chat_history")
    try:
        while True:
            data = await websocket.receive_text()

            response = run_crystal_ball_assistant(data, conversation_memory[client_id])

            async for res in response:
                if isinstance(res, dict):
                    # Extract logs from 'actions' for intermediate responses
                    if 'actions' in res and res['actions']:
                        for action in res['actions']:
                            log = action.log
                            if log:
                                await manager.send_personal_message(f"{log}", websocket)
                    
                    # Extract and send the final answer in 'output' for the final response
                    if 'output' in res:
                        final_answer = res['output']
                        await manager.send_personal_message(f"{final_answer}", websocket)

                        # Google Text-to-Speech Interface
                        tts = gTTS(final_answer, lang='en')
                        
                        # Save speech to a BytesIO object
                        audio_file = BytesIO()
                        tts.write_to_fp(audio_file)
                        audio_file.seek(0)

                        # Convert to base64
                        audio_data = base64.b64encode(audio_file.read()).decode("utf-8")

                        # Send the audio message (base64-encoded) to the WebSocket
                        await manager.send_voice_message(f"audio:{audio_data}", websocket)

                        await asyncio.sleep(2)  # Pause to ensure smooth delivery

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast(f"Client #{client_id} left the chat")
