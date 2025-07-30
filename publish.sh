#!/bin/bash

# מערכת חילוץ נתונים ממסמכים - סקריפט פרסום
echo "🚀 מתחיל תהליך פרסום מערכת חילוץ נתונים ממסמכים..."

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

# בניית האפליקציה לפרסום
echo "🔨 בונה את האפליקציה לפרסום..."
if npm run build; then
    echo "✅ הבנייה הושלמה בהצלחה"
else
    echo "❌ שגיאה בבניית האפליקציה"
    exit 1
fi

# יצירת ארכיון לפרסום
echo "📦 יוצר ארכיון לפרסום..."
if [ -d "build" ]; then
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    ARCHIVE_NAME="document-data-extractor_${TIMESTAMP}.tar.gz"
    
    tar -czf "$ARCHIVE_NAME" -C build .
    
    if [ $? -eq 0 ]; then
        echo "✅ ארכיון נוצר בהצלחה: $ARCHIVE_NAME"
        echo "📁 גודל הארכיון: $(du -h "$ARCHIVE_NAME" | cut -f1)"
    else
        echo "❌ שגיאה ביצירת הארכיון"
        exit 1
    fi
else
    echo "❌ תיקיית build לא נמצאה"
    exit 1
fi

echo ""
echo "🎉 תהליך הפרסום הושלם בהצלחה!"
echo ""
echo "📋 מידע על הפרסום:"
echo "   📁 תיקיית build: ./build/"
echo "   📦 ארכיון: ./$ARCHIVE_NAME"
echo "   🌐 האפליקציה מוכנה לפרסום על שרת סטטי"
echo ""
echo "🚀 אפשרויות פרסום:"
echo "   1. העלה את תוכן תיקיית build/ לשרת האינטרנט שלך"
echo "   2. השתמש בשירותי פרסום כמו Netlify, Vercel, או GitHub Pages"
echo "   3. הפעל שרת מקומי לבדיקה: npm install -g serve && serve -s build"
echo ""
echo "📖 לפרטים נוספים, ראה קובץ README.md"