import { Route, Routes} from "react-router-dom";

// Page Import
// Layout
// import Layout from "./pages/Layout";

// Chat
import Chat from "./pages/Chat";

export default function AppRouter() {
  return (
    <>
      {/* Add Button for Navigation */}
      <Routes>
        {/* <Route path="/" element={<Layout />}>
          <Route path="chat">
          </Route>
        </Route> */}
            <Route path="/" element={<Chat />} />
      </Routes>
    </>
  );
}