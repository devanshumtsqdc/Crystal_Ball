import time
import os
from langchain.prompts import PromptTemplate
import google.generativeai as genai
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.agents import initialize_agent, Tool,create_sql_agent
from langchain_core.tools import BaseTool
from config.env_vars import GOOGLE_API_KEY
from langchain.memory import ConversationBufferMemory
from pydantic import Field
from langchain.sql_database import SQLDatabase
from sqlalchemy import create_engine
from selenium import webdriver
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

api_key = genai.configure(api_key=GOOGLE_API_KEY)
gemini = ChatGoogleGenerativeAI(model='gemini-1.5-flash', temperature=0.5,api_key=api_key)
base_dir = os.path.dirname(os.path.abspath(__file__))  # Gets the directory of the current script
class ConversationMemoryTool(BaseTool):
    name: str = "conversation_memory"
    description: str = "Stores and retrieves user-agent conversation history."
    memory: ConversationBufferMemory = Field(default_factory=lambda: ConversationBufferMemory(return_messages=True))

    def _run(self, input_message: str) -> str:
        # Retrieve all conversation history
        return self.memory.load_memory_variables({}).get("chat_history", "No conversation history available.")

    def store(self, user_message: str, agent_response: str):
        # Add new messages to memory
        self.memory.chat_memory.add_user_message(user_message)
        self.memory.chat_memory.add_ai_message(agent_response)

    async def _arun(self, input_message: str) -> str:
        raise NotImplementedError("ConversationMemoryTool does not support async yet.")

class WebScraperAnalyzer(BaseTool):
    name: str = "Web Search Tool"
    description: str = (
        "Use this external search tool only if both conversation memory and database lack sufficient information."
    )
    base_urls: dict = Field(
        default={
            "brave": "https://search.brave.com/search?q=",
            "google": "https://www.google.com/search?q="
        },
        description="Base URLs for the web scraper tool."
    )
    llm: object = Field(..., description="LLM instance to process scraped data.")  # Required field

    def _get_driver(self):
        chrome_options = Options()
        chrome_options.add_argument("--headless")  # Run in headless mode
        return webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)

    def _scrape_page(self, url: str) -> str:
        """Scrape content from the given URL."""
        driver = self._get_driver()
        try:
            driver.get(url)
            # time.sleep(3)  # Wait for the page to load
            WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            page_source = driver.page_source
        finally:
            driver.quit()

        # Parse HTML with BeautifulSoup
        soup = BeautifulSoup(page_source, "lxml")
        titles = soup.find_all("div")  # Customize this to extract specific content
        data = [title.get_text() for title in titles]

        return " ".join(data)

    def _process_with_llm(self, text_data: str) -> str:
        """Analyze the scraped data using the LLM."""
        prompt = f"Analyze the following data and provide a summary:\n\n{text_data}"
        response = self.llm.invoke(prompt)  # Assuming the LLM instance has an `invoke` method
        return response.content

    def _scrape_from_engine(self, query: str, search_engine: str) -> str:
        """Scrape data from a specific search engine."""
        base_url = self.base_urls.get(search_engine)
        if not base_url:
            return f"Invalid search engine: {search_engine}"

        formatted_query = query.replace(" ", "+")
        full_url = f"{base_url}{formatted_query}"

        try:
            scraped_data = self._scrape_page(full_url)
            return scraped_data if scraped_data.strip() else "No data found on the page."
        except Exception as e:
            return f"Error while scraping {search_engine}: {e}"

    def _run(self, query: str):
        """
        Run the scraper for all search engines using ThreadPoolExecutor.
        
        Args:
            query (str): The search query.
        """
        results = {}

        with ThreadPoolExecutor() as executor:
            future_to_engine = {
                executor.submit(self._scrape_from_engine, query, engine): engine
                for engine in self.base_urls.keys()
            }

            for future in as_completed(future_to_engine):
                engine = future_to_engine[future]
                try:
                    results[engine] = future.result()
                except Exception as e:
                    results[engine] = f"Error: {e}"

        # Combine results from all search engines
        combined_results = []
        for engine, data in results.items():
            combined_results.append(f"Results from {engine.capitalize()}:\n{data}\n")

        # Process the combined results with LLM
        try:
            combined_text = "\n".join(combined_results)
            analysis_result = self._process_with_llm(combined_text)
            return analysis_result  # Return the analysis result
        except Exception as e:
            return f"An error occurred while processing data: {e}"

db_path = os.path.join(base_dir, "data", "database.db") 

engine = create_engine(f"sqlite:///{db_path}")
sql_database = SQLDatabase(engine=engine,include_tables=["database"])
sql_agent = create_sql_agent(gemini, db=sql_database, agent_type="tool-calling", verbose=True)

sql_tool = Tool(
        name="Database",
        func=sql_agent,
        description="Use this tool to retrieve detailed company data from database when conversation history is insufficient.",
)
web_scraper_tool = WebScraperAnalyzer(base_url="https://search.brave.com/search?q=", llm=gemini)

def run_crystal_ball_assistant(user_input,conversation_memory):

    if conversation_memory:
        memory_tool = ConversationMemoryTool(memory=conversation_memory)

        
    tools = [
        Tool(
            name="Conversation Memory",
            func=memory_tool,
            description="This is the primary tool for retrieving previous conversations relevant to the query."
        ),
        sql_tool,
        Tool(
            name=web_scraper_tool.name,
            description=web_scraper_tool.description,
            func=web_scraper_tool._run
        )

    ]

    prompt_template = """
    You are an intelligent assistant designed to answer user queries about companies. Your primary task is to provide a comprehensive response by sequentially accessing available sources of information. Stop querying additional sources as soon as relevant information is found.

    User Query: {query}

    Chat History:
    {chat_history}

    ### Step-by-Step Process:

    1. **Review Chat History**:
    - First, analyze the chat history for any relevant information that addresses or partially answers the user's query.
    - If relevant information is found, include it in your response and **stop further searches**.
    - If no relevant information is found, proceed to the next step.

    2. **Query the Database**:
    - Search the 'Database' tool for relevant company details.
    - Include all relevant database findings in your response.
    - If this fully addresses the query, **stop further searches**. Otherwise, proceed to the next step.

    3. **Search On Web**:
    - Use Websearch Tool to gather additional details that complement the response.
    - Merge Websearch Tool insights into your answer only if no sufficient information is found in prior steps.

    ### Response Format:

    1. Begin with information retrieved from **Chat History**, clearly labeled, if any.
    2. If no relevant chat history exists, include all relevant **Database findings**, clearly labeled and structured.
    3. Only include **You.com insights** if no sufficient information is found from the previous steps.
    4. Provide a clear and cohesive response that integrates information sequentially, stopping once enough information is available.

    By following these instructions, ensure your response is comprehensive while adhering to the sequential search order.
    """
    prompt = PromptTemplate(input_variables=["query", "chat_history"], template=prompt_template)

    # Initialize the agent
    agent_executor = initialize_agent(
        tools=tools,
        llm=gemini,
        agent="zero-shot-react-description",
        prompt=prompt,
        memory=conversation_memory,
        verbose=True,
        return_intermediate_steps=True
    )
    async def execute_agent(user_input):
        result = agent_executor.astream({"input": user_input})
        async for res in result:
            yield res
    return execute_agent(user_input)
