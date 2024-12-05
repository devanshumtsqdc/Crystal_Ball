// React Router DOM Imports
import { BrowserRouter as Router } from "react-router-dom";
// Components Imports
import AppRouter from "./AppRouter";
import ResponsiveComponent from "./components/ResponsiveComponent/ResponsiveComponent";

function App() {
  return (
    <Router>
      {/* Your app routing */}
      <AppRouter />
      {/* Render your responsive component */}
      <ResponsiveComponent />
    </Router>
  );
}

export default App;
