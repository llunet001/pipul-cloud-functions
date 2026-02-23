# Firebase Cloud Functions Setup

## 1) Install Firebase CLI (if needed)

```bash
npm install -g firebase-tools
```

## 2) Login to Firebase

```bash
firebase login
```

## 3) Select your Firebase project

Replace the project ID in `.firebaserc`, or run:

```bash
firebase use --add
```

## 4) Install dependencies

```bash
cd functions
npm install
```

## 5) Deploy functions

```bash
cd ..
firebase deploy --only functions
```

## 6) Local emulator

```bash
firebase emulators:start --only functions
```

The sample function is `helloWorld` in `functions/index.js`.
