import React, { useState, useEffect, useRef } from 'react';
import Textarea from '@/components/textarea/textarea';
import { LucideMic, LucideMicOff, LucideSend, LucideLoader,LucideVolume, LucideVolumeX,LucideArrowLeft  } from 'lucide-react';

interface Message {
  text: string;
  sender: 'user' | 'assistant';
}


const Chat: React.FC = () => {
  const [message, setMessage] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([
    { text: "Hello! I'm your Crystal Ball Assistant. Ask me anything, or choose from the suggestions below to get started.", sender: 'assistant' }
  ]);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isFirstQuery, setIsFirstQuery] = useState(true);
  const [displayedText, setDisplayedText] = useState('');
  const fullText = ' What can I help with?';
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [_currentThought, setCurrentThought] = useState<string | null>(null);
  const [finalAnswer, setFinalAnswer] = useState<string | null>(null);  
  const [currentThoughtTyped, setCurrentThoughtTyped] = useState('');
  const [_isThoughtTyping, setIsThoughtTyping] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const handleResetChat = () => {
    if (synth.speaking) synth.cancel();
    setMessages([
      { text: "Hello! I'm your Crystal Ball Assistant. Ask me anything, or choose from the suggestions below to get started.", sender: 'assistant' }
    ]);
    setMessage("");
    setIsFirstQuery(true);
    setIsThinking(false);
    setCurrentThought(null);
    setCurrentThoughtTyped('');
    setFinalAnswer(null);
    setDisplayedText('');
  };

  
  useEffect(() => {
    if (isFirstQuery && !isTypingComplete) {
      let index = 0;
      const interval = setInterval(() => {
        setDisplayedText((prev) => prev + fullText[index]);
        index += 1;
        if (index >= fullText.length - 1) {
          clearInterval(interval);
          setIsTypingComplete(true);
        }
      }, 30);
      return () => clearInterval(interval);
    }
  }, [isFirstQuery, isTypingComplete]);

  const clientId = 1;

  const recommendedPrompts = [
    "What should the investment thesis for Turbostart APAC and why?",
    "Who is the founder of Meolaa?",
    "What regulatory changes could impact TapInvest?",
    "Who will be the right set of investors for Turbostart MEA fund II?"
  ];
  
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const synth = window.speechSynthesis;
  const recognition = SpeechRecognition ? new SpeechRecognition() : null;
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const webSocketUrl =
      import.meta.env.VITE_NODE_ENV === "production"
        ? `wss://34.93.45.111/llm/ws/${clientId}`
        : `ws://127.0.0.1:8001/llm/ws/${clientId}`;
    const webSocket = new WebSocket(webSocketUrl);
  
    webSocket.onopen = () => console.log("WebSocket connected");
  
    webSocket.onmessage = (event) => {
      const newMessage = event.data.trim();
  
      // Helper function for typing effect
      const handleTypingEffect = (message) => {
        setIsThinking(true);
        setCurrentThought(message);
        setCurrentThoughtTyped("");
        setIsThoughtTyping(true);
  
        let index = -1;
        const interval = setInterval(() => {
          setCurrentThoughtTyped((prev) => prev + message[index]);
          index += 1;
          if (index >= message.length - 8) {
            clearInterval(interval);
            setIsThoughtTyping(false);
          }
        }, 5);
      };
  
      if (newMessage.startsWith("audio:")) {
        // Handle audio logic here if needed
      } else if (
        newMessage.startsWith("Thought:") ||
        newMessage.startsWith("Question:") ||
        newMessage.startsWith("Observation:")
      ) {
        const thought = newMessage.split(":")[1];
        handleTypingEffect(thought);
      } else {
        // Handle final answer logic
        let index = -1;
        const finalAnswer = newMessage;
        setIsThinking(false);
        setCurrentThought(null);
        setCurrentThoughtTyped("");
        setFinalAnswer("");
  
        const interval = setInterval(() => {
          setFinalAnswer((prev) => prev + finalAnswer[index]);
          index += 1;
          if (index >= finalAnswer.length-1) {
            clearInterval(interval);
  
            // Add completed final answer to messages
            setMessages((prevMessages) => [
              ...prevMessages,
              { text: finalAnswer, sender: "assistant" },
            ]);
  
            setFinalAnswer(null);
          }
        }, 5);
  
        // Speak the message if not muted
        if (!isMuted && synth) {
          const utterance = new SpeechSynthesisUtterance(finalAnswer);
          synth.cancel();
          synth.speak(utterance);
        }
      }
    };

    webSocket.onclose = () => console.log('WebSocket disconnected');
    setSocket(webSocket);

    return () => {
      if (webSocket) webSocket.close();
    };
  }, [clientId,isMuted]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isThinking]);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(event.target.value);
  };

  const handleSend = (text: string) => {
    if (text.trim() && socket) {
      const sanitizedText = text.replace(/[^a-zA-Z0-9.,!?'" ]/g, ''); 
      socket.send(sanitizedText);
      setMessages((prevMessages) => [...prevMessages, { text: sanitizedText, sender: 'user' }]);
      setMessage("");
      setCurrentThoughtTyped('');
      setIsFirstQuery(false);
      setIsThinking(true);
    }
  };

  const handlePromptClick = (prompt: string) => {
    handleSend(prompt);
  };

  const startVoiceRecognition = () => {
    if (recognition) {
      setIsRecording(true);
      recognition.start();
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        handleSend(transcript);
    };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
    } else {
      console.log("Speech recognition not supported in this browser.");
    }
  };

  const toggleVolume = () => {
    setIsMuted((prev) => !prev);
    if (synth.speaking) {
      if (!isMuted) {
        synth.pause(); // Mute: Pause the ongoing speech
      } else {
        synth.resume(); // Unmute: Resume the ongoing speech
      }
    }
  };

  return (
  <div className="flex flex-col h-dvh w-full md:w-2/3 rounded-lg overflow-hidden item">
    <div className="bg-black text-white py-3 font-semibold">
    <div className="flex justify-between items-center">
      <button
        onClick={handleResetChat}
        className="mx-2 bg-black text-white rounded-full focus:outline-none"
      >
        <LucideArrowLeft size={20} />
      </button>
      <h1 className='mx-auto'>Crystal Ball Assistant</h1>
    </div>
    </div>
      <div className="flex-1 p-4 overflow-y-auto ">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`p-3 my-2 rounded-lg mx-auto ${
              msg.sender === 'user' ? 'bg-gray-200 text-black self-end' : 'bg-gray-300 text-gray-800 self-start'
            } `}
          >
          <span className="flex-1">{msg.text}</span>
      
          {/* Add volume toggle button for assistant messages */}
          {msg.sender === 'assistant' && (
            <button
              onClick={toggleVolume}
              className="ml-2 text-gray-800 hover:text-black focus:outline-none"
            >
              {isMuted ? <LucideVolumeX size={18} /> : <LucideVolume size={18} />}
            </button>
          )}
          </div>
        ))}

        {/* Single Thought display */}
        {isThinking && (
          <div className="p-3 my-2 rounded-lg bg-gray-300 text-gray-600 self-start flex items-center blinking-background">
            <LucideLoader className="animate-spin mr-2" />
            <em >{currentThoughtTyped || "Thinking..."}</em>
          </div>
        )}
        {finalAnswer && (
          <div className="p-3 my-2 rounded-lg bg-gray-300 text-gray-800 self-start">
            <span className="flex-1">{finalAnswer}</span>
            <button
              onClick={toggleVolume}
              className="ml-2 text-gray-800 hover:text-black focus:outline-none"
            >
              {isMuted ? <LucideVolumeX size={18} /> : <LucideVolume size={18} />}
            </button>
                </div>
        )} 
        <div ref={messagesEndRef} />
      </div>

      <div
        className={`flex flex-col items-center p-4 transition-all duration-300 ${
          isFirstQuery ? 'justify-center h-3/4' : 'mt-auto'
        }`}
      >
        {isFirstQuery && (
          <h1 className="text-3xl font-semibold mb-4 text-center">{displayedText}</h1>
        )}
        <div className="flex items-center w-full max-w-2xl justify-center space-x-1">
          <Textarea 
            value={message} 
            onChange={handleChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); // Prevent default behavior of adding a new line
                handleSend(message);
              }
            }}
            placeholder="Type a message..." 
            className={`transition-all duration-300 ${
              isFirstQuery ? 'justify-center w-full h-16 max-w-2xl rounded-full' : 'justify-center w-full h-16 rounded-full'
            } border border-gray-300 rounded-full p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-lg`}
          />
          
          <button
            onClick={() => handleSend(message)}
            className="ml-2 px-4 py-2 bg-black text-white rounded-full hover:bg-gray-600 focus:outline-none"
          >
            <LucideSend />
          </button>
          <button
            onClick={startVoiceRecognition}
            className={`ml-2 px-4 py-2 ${isRecording ? 'bg-black' : 'bg-black'} text-white rounded-full hover:bg-gray-600 focus:outline-none`}
          >
            {isRecording ? <LucideMicOff /> : <LucideMic />}
          </button>
        </div>

        {isFirstQuery && (
          <div className="mt-4 flex flex-wrap justify-center">
            <h3 className="text-gray-600 font-semibold text-center">Suggestions:</h3>
            <div className="flex flex-wrap text-wrap justify-center mt-4">
              {recommendedPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handlePromptClick(prompt)}
                  className="m-1 px-3 py-1 bg-gray-200 text-black rounded-lg hover:bg-gray-300"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
