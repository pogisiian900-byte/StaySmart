import { Route, createBrowserRouter, createRoutesFromElements, RouterProvider } from 'react-router-dom';
import { lazy, Suspense } from 'react';
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
import { AuthProvider } from './layout/AuthContext.jsx';

// Lazy load all route components for code splitting
const Registration_forAll = lazy(() => import('./pages/for-all/registration-forAll.jsx'));
const LoginPage_Host = lazy(() => import('./pages/host/loginPage-all.jsx'));
const SetupService = lazy(() => import('./pages/for-all/setupService.jsx'));
const GetStarted = lazy(() => import('./pages/for-all/getStarted.jsx'));
const GuestMainLogged = lazy(() => import('./pages/guest/guest-MainLogged.jsx'));
const Guest_Main = lazy(() => import('./pages/guest/guest-Main.jsx'));
const HostMain = lazy(() => import('./pages/host/host-Main.jsx'));
const Admin_Main = lazy(() => import('./pages/admin/admin-Main.jsx'));
const Profile = lazy(() => import('./components/Profile.jsx'));
const HostSetupForm = lazy(() => import('./pages/for-all/HostSetupForm/HostSetupForm.jsx'));
const ViewListing = lazy(() => import('./components/Host/viewListing.jsx'));
const SelectListingItem = lazy(() => import('./components/SelectListingItem.jsx'));
const GuestLayout = lazy(() => import('./pages/guest/GuestLayout.jsx'));
const SelectedListingBookingConfirmation = lazy(() => import('./components/SelectedListingBookingConfirmation.jsx'));
const ChatPage = lazy(() => import('./pages/for-all/messages/ChatPage.jsx'));
const GuestConvoList = lazy(() => import('./pages/for-all/messages/GuestConvoList.jsx'));
const HostConvoList = lazy(() => import('./pages/for-all/messages/HostConvoList.jsx'));
const GuestBookings = lazy(() => import('./pages/guest/GuestBookings.jsx'));
const HostBookings = lazy(() => import('./pages/host/HostBookings.jsx'));
const GuestNotifications = lazy(() => import('./pages/guest/GuestNotifications.jsx'));
const HostNotifications = lazy(() => import('./pages/host/HostNotifications.jsx'));
const GuestSearch = lazy(() => import('./pages/guest/GuestSearch.jsx'));
const GuestFavourites = lazy(() => import('./pages/guest/GuestFavourites.jsx'));
const GuestAccountSettings = lazy(() => import('./pages/guest/GuestAccountSettings.jsx'));
const GuestReviews = lazy(() => import('./pages/guest/GuestReviews.jsx'));
const HostAccountSettings = lazy(() => import('./pages/host/HostAccountSettings.jsx'));
const SharedListing = lazy(() => import('./pages/for-all/SharedListing.jsx'));

// Loading fallback component
const LoadingFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
    <div>Loading...</div>
  </div>
);

function App() {
  const router = createBrowserRouter(
    createRoutesFromElements(
      <Route path="/" element={<RootLayout />}>
        <Route index element={
          <PublicRoute>
            <Suspense fallback={<LoadingFallback />}>
              <Guest_Main />
            </Suspense>
          </PublicRoute>
          } />

        <Route
          path="/register"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <Registration_forAll />
            </Suspense>
          }
        />

          <Route  
          path="/listing/:listingId"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <SharedListing />
            </Suspense>
          }/>
     <Route
            path="/guest/:guestId"
            element={
              <ProtectedRoute allowedRole="guest">
                <Suspense fallback={<LoadingFallback />}>
                  <GuestLayout />
                </Suspense>
              </ProtectedRoute>
            }
          >
            <Route index element={<Suspense fallback={<LoadingFallback />}><GuestMainLogged /></Suspense>} />
            <Route path="account-settings" element={<Suspense fallback={<LoadingFallback />}><GuestAccountSettings /></Suspense>} />
            <Route path="listing/:listingId" element={<Suspense fallback={<LoadingFallback />}><SelectListingItem /></Suspense>} />
            <Route path="messages" element={<Suspense fallback={<LoadingFallback />}><GuestConvoList /></Suspense>} />
            <Route path="bookings" element={<Suspense fallback={<LoadingFallback />}><GuestBookings /></Suspense>} />
            <Route path="favourites" element={<Suspense fallback={<LoadingFallback />}><GuestFavourites /></Suspense>} />
            <Route path="reviews" element={<Suspense fallback={<LoadingFallback />}><GuestReviews /></Suspense>} />
            <Route path="notifications" element={<Suspense fallback={<LoadingFallback />}><GuestNotifications /></Suspense>} />
            <Route path="search" element={<Suspense fallback={<LoadingFallback />}><GuestSearch /></Suspense>} />
            {/* ✅ Fix here */}
            <Route
              path="chat/:conversationId"
              element={
                <ProtectedRoute allowedRole={["guest", "host"]}>
                  <Suspense fallback={<LoadingFallback />}>
                    <ChatPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />

            <Route
              path="listing/:listingId/booking"
              element={<Suspense fallback={<LoadingFallback />}><SelectedListingBookingConfirmation /></Suspense>}
            />
          </Route>


          

       <Route path="/getStarted/:hostId">
              <Route index element={<Suspense fallback={<LoadingFallback />}><GetStarted /></Suspense>} />

              {/* Setup service selection */}
              <Route path="setupService" element={<Suspense fallback={<LoadingFallback />}><SetupService useCase={"getStarted"} /></Suspense>} />

              {/* ✅ Create new listing */}
              <Route path="setupService/:serviceType" element={<Suspense fallback={<LoadingFallback />}><HostSetupForm /></Suspense>} />
              
              {/* ✅ Support direct pattern for backwards compatibility */}
              <Route path=":serviceType" element={<Suspense fallback={<LoadingFallback />}><HostSetupForm /></Suspense>} />

          
          
            </Route>

          <Route path='/login' element={<Suspense fallback={<LoadingFallback />}><LoginPage_Host /></Suspense>} />
      <Route path="/host">
       
       
        <Route
          path=":hostId"
          element={
            <ProtectedRoute allowedRole="host">
              <Suspense fallback={<LoadingFallback />}>
                <HostMain />
              </Suspense>
            </ProtectedRoute>
          }
        >
          <Route index element={<div />} />
          <Route path=":listingId" element={<Suspense fallback={<LoadingFallback />}><ViewListing /></Suspense>} />
          <Route path="startingListing" element={<Suspense fallback={<LoadingFallback />}><SetupService /></Suspense>} />
          <Route path="getStarted/:serviceType" element={<Suspense fallback={<LoadingFallback />}><HostSetupForm /></Suspense>} />
          <Route path="draft/:serviceType/:draftId" element={<Suspense fallback={<LoadingFallback />}><HostSetupForm /></Suspense>} />
          <Route path="profile" element={<Suspense fallback={<LoadingFallback />}><Profile /></Suspense>} />
          <Route path="bookings" element={<Suspense fallback={<LoadingFallback />}><HostBookings /></Suspense>} />
          <Route path="notifications" element={<Suspense fallback={<LoadingFallback />}><HostNotifications /></Suspense>} />
          <Route path="account-settings" element={<Suspense fallback={<LoadingFallback />}><HostAccountSettings /></Suspense>} />

          {/* ✅ Host Messaging Routes */}
          <Route
            path="messages"
            element={
              <ProtectedRoute allowedRole="host">
                <Suspense fallback={<LoadingFallback />}>
                  <HostConvoList />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="chat/:conversationId"
            element={
              <ProtectedRoute allowedRole={["host", "guest"]}>
                <Suspense fallback={<LoadingFallback />}>
                  <ChatPage />
                </Suspense>
              </ProtectedRoute>
            }
          />
        </Route>
      </Route>

        

  
        <Route path="/admin" element={
          <ProtectedRoute allowedRole="admin">
            <Suspense fallback={<LoadingFallback />}>
              <Admin_Main />
            </Suspense>
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
