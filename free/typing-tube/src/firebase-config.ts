// Firebase コンソールの「ウェブアプリ」で表示される firebaseConfig。
// null にすると、みんなの譜面とランキングは表示されない。
// この値は公開されても問題ない種類のもので、書き込みの制限は firestore.rules で行う。
// Analytics は使わないので measurementId は入れていない。
import type { FirebaseOptions } from 'firebase/app';

export const firebaseConfig: FirebaseOptions | null = {
  apiKey: 'AIzaSyCd8pU4Erfm3ozeZo_TantNg4FXPolnUdc',
  authDomain: 'typing-tube.firebaseapp.com',
  projectId: 'typing-tube',
  storageBucket: 'typing-tube.firebasestorage.app',
  messagingSenderId: '543463175453',
  appId: '1:543463175453:web:366f136c2f999f2e8e1df4',
};
