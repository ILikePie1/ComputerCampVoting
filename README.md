# Two-Vote Scenario Poll - 15 Named Scenarios

This version supports up to 15 voting scenarios. Each scenario is a person's name, and each public browser can vote for up to 2 scenarios total.

- `index.html` is the public voting page.
- `admin.html` is the private admin page.
- Empty name slots are hidden from the public voting page.
- Public users see one `Vote` button per visible person/scenario.
- Public users cannot read vote totals.
- Admins can sign in, edit the 15 names, see live vote totals, and reset votes for individual scenarios.

## Files

```text
index.html              Public voting page
app.js                  Public voting logic with a two-vote browser limit
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
    "1": { "count": 4 },
    "2": { "count": 6 }
  }
}
```

Only `/scenarios` is publicly readable because voters need to see the names. `/votes` is readable only by admins.

## How the two-vote limit works

The public page uses browser `localStorage` to remember which scenarios were voted for from that browser. After two votes, all remaining vote buttons are disabled in that browser.

This is good enough for a demo or informal poll, but it is not secure because a user can clear browser data, use another browser, or manually call the database. For a serious election, require Firebase Authentication for every voter and store votes by user ID.

## Replacing a name after votes exist

If you replace a person in a slot, the old vote total for that slot remains until you reset it. Use the `Reset Votes` button for that scenario on the admin page before opening voting for a new person.

## Upgrading from the previous yes/no version

The old version stored votes like this:

```json
"votes": {
  "1": { "yes": 4, "no": 2 }
}
```

This version stores votes like this:

```json
"votes": {
  "1": { "count": 6 }
}
```

The admin page now reads only `count`. If your database still has old `yes` and `no` fields, use `Reset Votes` for each scenario or manually replace each scenario's vote object with `{ "count": 0 }`.

## Troubleshooting: names flash, then return to "No name set"

That means Firebase accepted the change locally in the browser, but the Realtime Database rules rejected the write on the server. Check that the signed-in admin user's Firebase Authentication UID is listed in the Realtime Database under `/admins/{uid}` with the boolean value `true`.

Example:

```json
{
  "admins": {
    "PASTE_AUTH_USER_UID_HERE": true
  }
}
```
