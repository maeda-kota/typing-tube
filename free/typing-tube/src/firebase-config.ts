// Firebase コンソールの「ウェブアプリ」で表示される firebaseConfig をここに入れる。
// null のままなら、みんなの譜面とランキングは表示されない。
// この値は公開されても問題ない種類のもので、書き込みの制限は firestore.rules で行う。
import type { FirebaseOptions } from 'firebase/app';

export const firebaseConfig: FirebaseOptions | null = null;
