import { BrowserRouter, HashRouter } from 'react-router-dom'

// Picks the router by how the app was loaded, so ONE build works everywhere:
//   file://  (desktop, APP_MODE=local, bundled build) -> HashRouter, because
//            there's no server to map /tickets to a file and BrowserRouter
//            would read a file-path pathname that matches no route.
//   http(s)  (web on Netlify, or desktop APP_MODE=remote loading the deployed
//            URL) -> BrowserRouter, with clean URLs; Netlify's SPA redirect
//            (netlify.toml) handles deep links.
export default function AppRouter({ children }) {
  const useHash = typeof window !== 'undefined' && window.location.protocol === 'file:'
  const Router = useHash ? HashRouter : BrowserRouter
  return <Router>{children}</Router>
}
