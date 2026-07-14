# Yes / No Voting Website

This is a static HTML, CSS, and JavaScript voting website that stores live vote counts in Firebase Realtime Database.

## Files

- `index.html` - page markup
- `style.css` - design and responsive layout
- `app.js` - Firebase connection, live count listener, and vote buttons
- `database.rules.json` - example Firebase Realtime Database security rules

## Firebase setup

1. Create a Firebase project.
2. Add a Web App to the project.
3. Create a Realtime Database.
4. Copy your Web App config into `firebaseConfig` in `app.js`.
5. Make sure `databaseURL` is present in the config.
6. In Realtime Database > Rules, paste the contents of `database.rules.json`, then publish.
7. Open `index.html` with a local server, such as VS Code Live Server.

## Important note

This app limits voting to one vote per browser with `localStorage`. That is useful for a simple demo poll, but it is not strong security. For production, add Firebase Authentication and store one vote per authenticated user.
