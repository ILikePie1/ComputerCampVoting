# Two-Vote Scenario Poll - Descriptions and Unvote

This version supports up to 15 voting scenarios. Each scenario has a person's name, an optional short description, and one public `Vote` button.

Each public browser can vote for up to 2 visible scenarios total. After voting for a scenario, that scenario's button changes to `Unvote`, allowing the browser to remove that vote and choose another scenario.

- `index.html` is the public voting page.
- `admin.html` is the private admin page.
- Empty name slots are hidden from the public voting page.
- Public users can see names and descriptions, but not vote totals.
- Admins can sign in, edit the 15 names/descriptions, see live vote totals, reset votes for individual scenarios, and unlock a reset-all option.

## Files

```text
index.html              Public voting page
app.js                  Public voting and unvote logic with a two-vote browser limit
admin.html              Admin login, scenario editor, and results page
admin.js                Admin Firebase Auth, detail saving, results, individual reset, and reset-all logic
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
10. Open `admin.html`, sign in, and enter up to 15 names and descriptions.
11. Open `index.html` to vote.

## Database structure

The app uses this structure:

```json
{
  "admins": {
    "ADMIN_UID_HERE": true
  },
  "scenarios": {
    "1": {
      "name": "Alice",
      "description": "Captain of the debate team.",
      "resetAt": 1721000000000
    },
    "2": {
      "name": "Bob",
      "description": "Volunteers at every school event."
    }
  },
  "votes": {
    "1": { "count": 4 },
    "2": { "count": 6 }
  }
}
```

Only `/scenarios` is publicly readable because voters need to see names and descriptions. `/votes` is readable only by admins.

## How the two-vote limit and unvote work

The public page uses browser `localStorage` to remember which scenarios were voted for from that browser. After two votes, all remaining unselected vote buttons are disabled. Buttons for already selected scenarios stay enabled as `Unvote` buttons.

When a user clicks `Unvote`, the app subtracts 1 from that scenario's count and removes that scenario from the browser's local vote list.

This is good enough for a demo or informal poll, but it is not secure because a user can clear browser data, use another browser, or manually call the database. For a serious election, require Firebase Authentication for every voter and store votes by user ID.


## Resetting votes and browser vote limits

Admins can reset votes in two ways:

- Use `Reset Votes` on one scenario to reset that scenario only.
- Turn on `Enable reset all votes`, then click `Reset All Votes` to reset all 15 scenarios.

Every reset also updates a public `resetAt` token for the affected scenario. The public page compares that token against the browser's saved local votes. When the token changes, stale saved votes are cleared automatically, so voters get that vote slot back.

For example, if a browser voted for Alice and Bob and Alice is reset, that browser will be able to vote for one more scenario again. If all votes are reset, that browser can vote for up to 2 scenarios again.

## Replacing a name after votes exist

If you replace a person in a slot, the old vote total for that slot remains until you reset it. Use the `Reset Votes` button for that scenario before opening voting for a new person.

## Upgrading from the previous two-vote version

This version keeps the same vote format:

```json
"votes": {
  "1": { "count": 6 }
}
```

It adds an optional description field and a reset token:

```json
"scenarios": {
  "1": {
    "name": "Alice",
    "description": "Short description here.",
    "resetAt": 1721000000000
  }
}
```

This version keeps the same localStorage key as the previous two-vote version, so browsers that already voted should still show their previous selections and can unvote them.

## Troubleshooting: names/descriptions flash, then reset

That means Firebase accepted the change locally in the browser, but the Realtime Database rules rejected the write on the server. Check that the signed-in admin user's Firebase Authentication UID is listed in the Realtime Database under `/admins/{uid}` with the boolean value `true`.

Example:

```json
{
  "admins": {
    "PASTE_AUTH_USER_UID_HERE": true
  }
}
```
