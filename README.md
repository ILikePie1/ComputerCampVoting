# Yes / No Voting Website - 15 Named Scenarios

This version supports up to 15 yes/no voting scenarios. Each scenario is a person's name.

- `index.html` is the public voting page.
- `admin.html` is the private admin page.
- Empty name slots are hidden from the public voting page.
- Public users can vote yes or no for each visible person.
- Public users cannot read vote totals.
- Admins can sign in, edit the 15 names, see live results, and reset votes for individual scenarios.

## Files

```text
index.html              Public voting page
app.js                  Public voting logic
admin.html              Admin login, name editor, and results page
admin.js                Admin Firebase Auth, name saving, and results logic
firebase-config.js      Shared Firebase config used by both pages
style.css               Shared styling
database.rules.json     Firebase Realtime Database security rules
README.md               Setup notes
```

## Firebase setup

1. Create a Firebase project.
2. Add a Web App.
3. Copy your Firebase Web App config into `firebase-config.js`.
4. Create a Realtime Database and make sure `databaseURL` is included in `firebase-config.js`.
5. In Firebase Authentication, enable Email/Password sign-in.
6. Create an admin user in Authentication > Users.
7. Copy that user's UID.
8. In Realtime Database > Data, manually add your admin UID:

```json
{
  "admins": {
    "PASTE_ADMIN_UID_HERE": true
  }
}
```

9. In Realtime Database > Rules, paste the contents of `database.rules.json` and publish.
10. Open `admin.html`, sign in, and enter up to 15 names.
11. Open `index.html` to vote.

## Database structure

The app uses this structure:

```json
{
  "admins": {
    "ADMIN_UID_HERE": true
  },
  "scenarios": {
    "1": { "name": "Alice" },
    "2": { "name": "Bob" },
    "3": { "name": "Charlie" }
  },
  "votes": {
    "1": { "yes": 4, "no": 2 },
    "2": { "yes": 1, "no": 6 }
  }
}
```

Only `/scenarios` is publicly readable because voters need to see the names. `/votes` is readable only by admins.

## Important voting notes

The public page uses browser `localStorage` to discourage repeat voting, one vote per visible person from the same browser. This is good enough for a demo or informal poll, but it is not secure because a user can clear browser data or use another browser.

For a serious election, require Firebase Authentication for every voter and store votes by user ID.

## Replacing a name after votes exist

If you replace a person in a slot, the old vote totals for that slot remain until you reset them. Use the `Reset Votes` button for that scenario on the admin page before opening voting for a new person.
