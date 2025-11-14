import { Route, createBrowserRouter, createRoutesFromElements, RouterProvider } from 'react-router-dom';
import './App.css';
import './index.css';
import './pages/for-all/HostRegis.css'
import './pages/for-all/HostSetupForm/HostSetupForm.css'
import './pages/host/navigations.css'
import './pages/host/host-dashboard.css'
import './pages/host/host-listing.css'
import './pages/guest/guest-viewListing.css'
import './pages/guest/guest-bookingConfirmation.css'
import './pages/guest/guest-reviews.css'
import './pages/booking-responsive.css'
import RootLayout from './layout/RootLayout.jsx';
import ProtectedRoute from './layout/ProtectedRoute.jsx';
import PublicRoute from './layout/PublicRoute.jsx';
import Error from './components/Error.jsx';
import Registration_forAll from './pages/for-all/registration-forAll.jsx';
import LoginPage_Host from './pages/host/loginPage-all.jsx';
import SetupService from './pages/for-all/setupService.jsx';
import GetStarted from './pages/for-all/getStarted.jsx';
import GuestMainLogged from './pages/guest/guest-MainLogged.jsx';
import Guest_Main from './pages/guest/guest-Main.jsx';
import HostMain from './pages/host/host-Main.jsx';
import Admin_Main from './pages/admin/admin-Main.jsx';
import { AuthProvider } from './layout/AuthContext.jsx';
import Profile from './components/Profile.jsx';
import HostSetupForm from './pages/for-all/HostSetupForm/HostSetupForm.jsx';
import ViewListing from './components/Host/viewListing.jsx';
import SelectListingItem from './components/SelectListingItem.jsx';
import Guest_Main_NextPageOutlet from './pages/guest/GuestLayout.jsx';
import GuestLayout from './pages/guest/GuestLayout.jsx';
import SelectedListingBookingConfirmation from './components/SelectedListingBookingConfirmation.jsx';
import ChatPage from './pages/for-all/messages/ChatPage.jsx';
import GuestConvoList from './pages/for-all/messages/GuestConvoList.jsx';
import HostConvoList from './pages/for-all/messages/HostConvoList.jsx';
import GuestBookings from './pages/guest/GuestBookings.jsx';
import HostBookings from './pages/host/HostBookings.jsx';
import GuestNotifications from './pages/guest/GuestNotifications.jsx';
import HostNotifications from './pages/host/HostNotifications.jsx';
import GuestSearch from './pages/guest/GuestSearch.jsx';
import GuestFavourites from './pages/guest/GuestFavourites.jsx';
import GuestAccountSettings from './pages/guest/GuestAccountSettings.jsx';
import GuestReviews from './pages/guest/GuestReviews.jsx';
import HostAccountSettings from './pages/host/HostAccountSettings.jsx';
import SharedListing from './pages/for-all/SharedListing.jsx';

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
          path="/register"
          element={
              <Registration_forAll />
          }
        />

          <Route  
          path="/listing/:listingId"
          element={
              <SharedListing />
          }/>
     <Route
            path="/guest/:guestId"
            element={
              <ProtectedRoute allowedRole="guest">
                <GuestLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<GuestMainLogged />} />
            <Route path="account-settings" element={<GuestAccountSettings />} />
            <Route path="listing/:listingId" element={<SelectListingItem />} />
            <Route path="messages" element={<GuestConvoList />} />
            <Route path="bookings" element={<GuestBookings />} />
            <Route path="favourites" element={<GuestFavourites />} />
            <Route path="reviews" element={<GuestReviews />} />
            <Route path="notifications" element={<GuestNotifications />} />
            <Route path="search" element={<GuestSearch />} />
            {/* ✅ Fix here */}
            <Route
              path="chat/:conversationId"
              element={
                <ProtectedRoute allowedRole={["guest", "host"]}>
                  <ChatPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="listing/:listingId/booking"
              element={<SelectedListingBookingConfirmation />}
            />
          </Route>


          

       <Route path="/getStarted/:hostId">
              <Route index element={<GetStarted />} />

              {/* Setup service selection */}
              <Route path="setupService" element={<SetupService useCase={"getStarted"} />} />

              {/* ✅ Create new listing */}
              <Route path="setupService/:serviceType" element={<HostSetupForm />} />
              
              {/* ✅ Support direct pattern for backwards compatibility */}
              <Route path=":serviceType" element={<HostSetupForm />} />

          
          
            </Route>

          <Route path='/login' element={<LoginPage_Host />} />
      <Route path="/host">
       
       
        <Route
          path=":hostId"
          element={
            <ProtectedRoute allowedRole="host">
              <HostMain />
            </ProtectedRoute>
          }
        >
          <Route index element={<div />} />
          <Route path=":listingId" element={<ViewListing />} />
          <Route path="startingListing" element={<SetupService />} />
          <Route path="getStarted/:serviceType" element={<HostSetupForm />} />
          <Route path="draft/:serviceType/:draftId" element={<HostSetupForm />} />
          <Route path="profile" element={<Profile />} />
          <Route path="bookings" element={<HostBookings />} />
          <Route path="notifications" element={<HostNotifications />} />
          <Route path="account-settings" element={<HostAccountSettings />} />

          {/* ✅ Host Messaging Routes */}
          <Route
            path="messages"
            element={
              <ProtectedRoute allowedRole="host">
                <HostConvoList />
              </ProtectedRoute>
            }
          />
          <Route
            path="chat/:conversationId"
            element={
              <ProtectedRoute allowedRole={["host", "guest"]}>
                <ChatPage />
              </ProtectedRoute>
            }
          />
        </Route>
      </Route>

        

  
        <Route path="/admin" element={
          <ProtectedRoute allowedRole="admin">
            <Admin_Main />
          </ProtectedRoute>
        } />
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
