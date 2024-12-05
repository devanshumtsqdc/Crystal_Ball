// import { Route, Routes } from "react-router-dom";

// // Page Import
// // Layout
// import Layout from "./pages/Layout";

// // Chat
// import Chat from "./pages/Chat";

// export default function AppRouter() {
//   return(
//     <Routes>
//       <Route path="/" element={<Layout />}>
//       <Route path="chat">
//           <Route path=":chat_id" element={<Chat />} />
//       </Route>
//       </Route>
//     </Routes>
//   )
// }

import { Route, Routes } from "react-router-dom";

// Page Import
// Layout
import Layout from "./pages/Layout";

// Chat
import Chat from "./pages/Chat";

export default function AppRouter() {
  return (
    <Routes>
      {/* Redirect the root path to the Chat component */}
      <Route path="/" element={<Layout />}>
        <Route index element={<Chat />} />
        {/* Optionally, keep support for nested chat IDs if needed */}
        <Route path=":chat_id" element={<Chat />} />
      </Route>
    </Routes>
  );
}
