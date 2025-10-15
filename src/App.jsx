import { Route, createBrowserRouter, createRoutesFromElements, RouterProvider } from 'react-router-dom';
import './App.css';
import './index.css';
import RootLayout from './layout/RootLayout.jsx';
import ProtectedRoute from './layout/ProtectedRoute.jsx';
import PublicRoute from './layout/PublicRoute.jsx';
import Error from './components/Error.jsx';
import Registration_forAll from './pages/for-all/registration-forAll.jsx';
import LoginPage_Host from './pages/host/loginPage-host.jsx';
import SetupService from './pages/for-all/setupService.jsx';
import GetStarted from './pages/for-all/getStarted.jsx';
import GuestMainLogged from './pages/guest/guest-MainLogged.jsx';
import Guest_Main from './pages/guest/guest-Main.jsx';
import HostMain from './pages/host/host-Main.jsx';
import Admin_Main from './pages/admin/admin-Main.jsx';
import { AuthProvider } from './layout/AuthContext.jsx';
import Profile from './components/Profile.jsx';
import HostSetupForm from './pages/for-all/HostSetupForm/HostSetupForm.jsx';

function App() {
  const router = createBrowserRouter(
    createRoutesFromElements(
      <Route path="/" element={<RootLayout />}>
        <Route index element={
          <PublicRoute>
              <Guest_Main />
          </PublicRoute>
          } />

        <Route
          path="/register/:openedAs"
          element={
              <Registration_forAll />
          }
        />

        <Route
          path="/guest/:guestId"
          element={
            <ProtectedRoute allowedRole="guest">
              <GuestMainLogged />
            </ProtectedRoute>
          }
        />

        <Route path="/getStarted/:createdAs">
          <Route index element={<GetStarted />} />
          <Route path="setupService" element={<SetupService />} />
          <Route path="setupService/:serviceType" element={<HostSetupForm />} />
        </Route>

        <Route path="/host">
          <Route index element={<LoginPage_Host />} />
          <Route
            path=":hostId"
            element={
                         <ProtectedRoute allowedRole="host">
                <HostMain />
              </ProtectedRoute>
            }
          />
            <Route path='/host/:hostId/profile' element={<Profile/>}/>

        </Route>

        <Route path="/admin" element={<Admin_Main />} />
        <Route path="*" element={<Error />} />
      </Route>
    )
  );

  return (
    <div className="main-app">
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </div>
  );
}

export default App;
