The `LocationsPage` component is a comprehensive dashboard for providing real-time situational awareness for a motorcycle club. It integrates with Firebase for user data and a custom `useTrafficData` hook to fetch traffic and incident data from the Smartroads API.

Here is a breakdown of its features:

**Core Functionality:**

The `LocationsPage` component is designed to provide a real-time view of active members on a map, along with relevant traffic information and incident alerts. It integrates with Firebase for user data and a custom `useTrafficData` hook to fetch traffic and incident data from the Smartroads API.

**Key Features:**

1.  **Live Location Tracking:**
    *   It fetches all users from the `users` collection in Firestore where `gpsActive` is set to `true`.
    *   It displays each active member on a Google Map using a custom `ActiveMemberMarker` component, which shows the member's road name and a status indicator.

2.  **"Who's Riding Now" Section:**
    *   This section displays a list of all active members in a card-based layout.
    *   Each card, represented by the `MemberStatusCard` component, shows the member's name, a status indicator (green for "All clear", red with a pulse for "critical incidents nearby"), and a count of total incidents within a 10-mile radius.
    *   It also provides a "View on Map" button to scroll to the map view.

3.  **GPS Status Toggle:**
    *   The `GpsStatusToggle` component allows the current user to enable or disable their GPS tracking.
    *   This component updates the `gpsActive` field for the current user in Firestore.

4.  **Traffic and Incident Overlay:**
    *   It uses the `useTrafficData` hook to fetch both planned and live traffic incidents from the Smartroads API.
    *   The `showTraffic` state, controlled by a toggle switch, determines whether to display the Google Maps traffic layer.
    *   When the map is zoomed in (level 13 or greater), it displays `TrafficEventMarker` components for each incident, with custom icons and colors based on the event type (e.g., crash, construction, police).

5.  **Route Incident Checker:**
    *   The `RouteIncidentChecker` component allows a user to input a route and see all incidents along that route.
    *   When a route is calculated, it displays the route on the map as a polyline and shows incident markers along the route.
    *   It also updates the `ActiveMemberMarker` to show if a member is on or off the calculated route.

**Data Flow:**

*   **User Data:**
    *   `useUserProfile` and `useCollection` hooks fetch user data from the `users` collection in Firestore.
    *   The `GpsStatusToggle` updates the `gpsActive` status in Firestore.
*   **Traffic Data:**
    *   The `useTrafficData` hook fetches traffic and incident data from the `/api/smartroads-proxy` and `/api/smartroads-incident-proxy` API routes.
*   **Map Data:**
    *   The `MemberMap` component uses the fetched `activeMembers` and `smartroadsEvents` to render markers on the map.
    *   The `RouteIncidentChecker` provides the `routeOverlay` data to the `MemberMap` to display the route and route-specific incidents.

In summary, the `LocationsPage` is a comprehensive dashboard for real-time situational awareness for a motorcycle club, providing a live map of active riders, traffic conditions, and incident alerts, with a specific feature for checking incidents along a planned route.
