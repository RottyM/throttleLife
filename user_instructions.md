
Alright, to see the "Who's Riding Now" section populate with active users, you'll need to manually update some user profiles in your Firebase console.

Here's how you can do it:

1.  **Go to your Firebase Console:** Open your web browser and navigate to your Firebase project.
2.  **Navigate to Firestore Database:** In the left-hand menu, find and click on "Firestore Database" (under the "Build" section).
3.  **Select the 'users' Collection:** You should see a collection named `users`. Click on it.
4.  **Choose a User Document:** Select any user document you wish to make "active" on the map.
5.  **Add/Update Fields:**
    *   **`gpsActive`**: Add a new field named `gpsActive` (if it doesn't exist) and set its type to `boolean` and its value to `true`.
    *   **`latitude`**: Add a new field named `latitude` and set its type to `number`. Enter a valid latitude coordinate (e.g., `38.9072`).
    *   **`longitude`**: Add a new field named `longitude` and set its type to `number`. Enter a valid longitude coordinate (e.g., `-77.0369`).
6.  **Save Changes:** Click the "Save" button to apply the changes to the user document.

Once you've done this for one or more users, they should start appearing on the map in the "Live Locations" page, assuming their `latitude` and `longitude` are within the visible map area and `gpsActive` is set to `true`.

Let me know once you've seeded some data, and we can verify if they appear correctly.
