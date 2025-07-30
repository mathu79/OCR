#!/bin/bash

# מערכת חילוץ נתונים ממסמכים - סקריפט הפעלה
echo "🚀 מתחיל הפעלת מערכת חילוץ נתונים ממסמכים..."

# בדיקת קיום Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js לא מותקן במערכת"
    echo "אנא התקן Node.js מ: https://nodejs.org/"
    exit 1
fi

# בדיקת קיום npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm לא מותקן במערכת"
    exit 1
fi

echo "✅ Node.js ו-npm מותקנים במערכת"

# בדיקת קיום package.json
if [ ! -f "package.json" ]; then
    echo "❌ קובץ package.json לא נמצא"
    exit 1
fi

# התקנת תלויות
echo "📦 מתקין תלויות..."
if npm install; then
    echo "✅ התלויות הותקנו בהצלחה"
else
    echo "❌ שגיאה בהתקנת התלויות"
    exit 1
fi

# הפעלת האפליקציה
echo "🌐 מפעיל את האפליקציה..."
echo "האפליקציה תיפתח בדפדפן בכתובת: http://localhost:3000"
echo "לעצירת האפליקציה, לחץ Ctrl+C"

npm start