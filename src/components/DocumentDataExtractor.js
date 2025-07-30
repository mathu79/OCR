import React, { useState, useRef } from 'react';
import { Upload, FileText, Download, Trash2, Eye, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';

const DocumentDataExtractor = () => {
  const [extractedData, setExtractedData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentView, setCurrentView] = useState('upload');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);

  const categories = ['חשבוניות', 'חוזים', 'דוחות', 'מכתבים', 'טפסים', 'תעודת זהות', 'רישיון נהיגה', 'אחר'];

  // פונקציות חילוץ נתונים
  const extractCompanyName = (content) => {
    const patterns = [
      /חברת\s+([א-ת\s\-"]{3,40})/gi,
      /חברה[:\s]+([א-ת\s\-"]{3,40})/gi,
      /בע״מ\s+([א-ת\s\-"]{3,40})/gi,
      /([א-ת\s\-"]{3,40})\s+בע״מ/gi,
      /Company[:\s]+([A-Za-z\s\-&.]{3,40})/gi
    ];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const result = match[1].trim();
        if (result.length > 2 && result.length < 50) {
          return result;
        }
      }
    }
    return '';
  };

  const extractAmount = (content) => {
    const patterns = [
      /(?:סכום|סה״כ|סהכ|סך הכל|total|amount)[:\s]*([0-9,]+(?:\.[0-9]{1,2})?)/gi,
      /([0-9,]+(?:\.[0-9]{1,2})?)\s*₪/gi,
      /([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:שקל|שקלים)/gi,
      /₪\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi
    ];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1].replace(/,/g, '');
      }
    }
    return '';
  };

  const extractDate = (content) => {
    const patterns = [
      /(\d{1,2}[/\-.]?\d{1,2}[/\-.]?\d{2,4})/g,
      /(\d{1,2}\s+(?:ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s+\d{4})/gi,
      /(?:תאריך|date)[:\s]*(\d{1,2}[/\-.]?\d{1,2}[/\-.]?\d{2,4})/gi
    ];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return '';
  };

  const extractEmail = (content) => {
    const pattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const match = content.match(pattern);
    return match ? match[0] : '';
  };

  const extractPhone = (content) => {
    const patterns = [
      /(0[2-9][0-9]?[\-\s]?[0-9]{7})/g,
      /(05[0-9][\-\s]?[0-9]{7})/g
    ];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[0]) {
        return match[0];
      }
    }
    return '';
  };

  const extractIdNumber = (content) => {
    const pattern = /\b([0-9]{9})\b/g;
    const match = content.match(pattern);
    return match ? match[0] : '';
  };

  const extractFullName = (content) => {
    const patterns = [
      /(?:שם מלא|שם)[:\s]*([א-ת]+\s+[א-ת]+(?:\s+[א-ת]+)?)/gi,
      /(?:לכבוד|מר|גב|דר)[:\s]*([א-ת]+\s+[א-ת]+(?:\s+[א-ת]+)?)/gi,
      /([א-ת]+\s+[א-ת]+)(?:\s+ת\.ז\.)/g,
      /ת\.ז\.\s*\d{9}\s*([א-ת]+\s+[א-ת]+)/g
    ];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        const words = name.split(/\s+/);
        if (words.length >= 2 && name.length > 4 && name.length < 50) {
          return name;
        }
      }
    }
    return '';
  };

  // פונקציה לסיווג מסמכים
  const classifyDocument = (content) => {
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('חשבונית') || lowerContent.includes('invoice') || 
        lowerContent.includes('קבלה') || lowerContent.includes('receipt')) {
      return 'חשבוניות';
    }
    if (lowerContent.includes('חוזה') || lowerContent.includes('contract') ||
        lowerContent.includes('הסכם') || lowerContent.includes('agreement')) {
      return 'חוזים';
    }
    if (lowerContent.includes('תעודת זהות') || lowerContent.includes('ת.ז') ||
        /\b\d{9}\b/.test(content)) {
      return 'תעודת זהות';
    }
    if (lowerContent.includes('רישיון נהיגה') || lowerContent.includes('רישיון')) {
      return 'רישיון נהיגה';
    }
    if (lowerContent.includes('דוח') || lowerContent.includes('report') ||
        lowerContent.includes('סיכום')) {
      return 'דוחות';
    }
    if (lowerContent.includes('מכתב') || lowerContent.includes('letter') ||
        lowerContent.includes('לכבוד')) {
      return 'מכתבים';
    }
    if (lowerContent.includes('טופס') || lowerContent.includes('form') ||
        lowerContent.includes('בקשה')) {
      return 'טפסים';
    }
    
    return 'אחר';
  };

  // פונקציה לחילוץ נתונים מקבצים
  const extractDataFromFile = async (file) => {
    const fileExtension = file.name.split('.').pop().toLowerCase();
    let content = '';
    
    try {
      if (fileExtension === 'txt') {
        content = await file.text();
      } else if (fileExtension === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        content = result.value;
      } else {
        content = await file.text();
      }

      const extractedFields = {
        id: Date.now() + Math.random(),
        fileName: file.name,
        fileType: fileExtension,
        uploadDate: new Date().toLocaleDateString('he-IL'),
        category: classifyDocument(content),
        content: content,
        contentPreview: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
        companyName: extractCompanyName(content),
        amount: extractAmount(content),
        date: extractDate(content),
        email: extractEmail(content),
        phone: extractPhone(content),
        idNumber: extractIdNumber(content),
        fullName: extractFullName(content)
      };

      return extractedFields;
    } catch (error) {
      console.error('שגיאה בחילוץ נתונים:', error);
      return {
        id: Date.now() + Math.random(),
        fileName: file.name,
        fileType: fileExtension,
        uploadDate: new Date().toLocaleDateString('he-IL'),
        category: 'אחר',
        content: 'שגיאה בקריאת הקובץ',
        contentPreview: 'שגיאה בקריאת הקובץ',
        companyName: '',
        amount: '',
        date: '',
        email: '',
        phone: '',
        idNumber: '',
        fullName: ''
      };
    }
  };

  // טיפול בהעלאת קבצים
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    setIsProcessing(true);
    
    for (const file of files) {
      const extractedData = await extractDataFromFile(file);
      if (extractedData) {
        setExtractedData(prev => [...prev, extractedData]);
      }
    }
    
    setIsProcessing(false);
    setCurrentView('manage');
  };

  // סינון נתונים
  React.useEffect(() => {
    let filtered = extractedData;
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(item => 
        Object.values(item).some(value => 
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
    
    setFilteredData(filtered);
  }, [extractedData, selectedCategory, searchTerm]);

  // יצוא לאקסל
  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredData.map(item => ({
      'שם קובץ': item.fileName,
      'קטגוריה': item.category,
      'שם חברה': item.companyName,
      'סכום': item.amount,
      'תאריך': item.date,
      'טלפון': item.phone,
      'שם מלא': item.fullName
    })));
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'נתונים');
    XLSX.writeFile(workbook, 'extracted_data.xlsx');
  };

  // צבעי קטגוריות
  const getCategoryColor = (category) => {
    const colors = {
      'חשבוניות': 'bg-green-100 text-green-800',
      'חוזים': 'bg-blue-100 text-blue-800',
      'דוחות': 'bg-purple-100 text-purple-800',
      'תעודת זהות': 'bg-teal-100 text-teal-800',
      'רישיון נהיגה': 'bg-orange-100 text-orange-800',
      'מכתבים': 'bg-pink-100 text-pink-800',
      'טפסים': 'bg-yellow-100 text-yellow-800',
      'אחר': 'bg-gray-100 text-gray-800'
    };
    return colors[category] || colors['אחר'];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* כותרת */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            מערכת חילוץ נתונים ממסמכים
          </h1>
          <p className="text-gray-600">העלה מסמכים וחלץ נתונים אוטומטית</p>
        </div>

        {/* תפריט */}
        <div className="flex justify-center mb-6">
          <div className="bg-white rounded-lg shadow-md p-2 flex gap-2">
            <button
              onClick={() => setCurrentView('upload')}
              className={`px-6 py-2 rounded-md flex items-center gap-2 ${
                currentView === 'upload' ? 'bg-blue-500 text-white' : 'text-gray-600'
              }`}
            >
              <Upload size={20} />
              העלאת קבצים
            </button>
            <button
              onClick={() => setCurrentView('manage')}
              className={`px-6 py-2 rounded-md flex items-center gap-2 ${
                currentView === 'manage' ? 'bg-blue-500 text-white' : 'text-gray-600'
              }`}
            >
              <FileText size={20} />
              ניהול נתונים ({extractedData.length})
            </button>
          </div>
        </div>

        {/* העלאת קבצים */}
        {currentView === 'upload' && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div
              className="border-2 border-dashed border-blue-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-400 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={48} className="mx-auto text-blue-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                לחץ להעלאת קבצים או גרור קבצים לכאן
              </h3>
              <p className="text-gray-500 mb-2">תומך בקבצי PDF, Word, טקסט</p>
              <p className="text-sm text-gray-400">המערכת תזהה אוטומטית עברית ותחלץ נתונים רלוונטיים</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
            
            {isProcessing && (
              <div className="mt-6 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-gray-600">מעבד קבצים...</p>
              </div>
            )}
          </div>
        )}

        {/* ניהול נתונים */}
        {currentView === 'manage' && (
          <div className="space-y-6">
            {/* כלים */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex gap-4 items-center justify-between">
                <div className="flex gap-4">
                  <input
                    type="text"
                    placeholder="חיפוש..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="px-3 py-2 border rounded-lg"
                  />
                  
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3 py-2 border rounded-lg"
                  >
                    <option value="all">כל הקטגוריות</option>
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                
                <button
                  onClick={exportToExcel}
                  disabled={filteredData.length === 0}
                  className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:bg-gray-300 flex items-center gap-2"
                >
                  <Download size={20} />
                  יצוא לאקסל
                </button>
              </div>
            </div>

            {/* טבלה */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">שם קובץ</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">קטגוריה</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">תצוגה מקדימה</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">חברה/שם</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">סכום</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">תאריך</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">טלפון</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredData.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                        אין נתונים להצגה
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {item.fileName}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getCategoryColor(item.category)}`}>
                            {item.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {item.contentPreview && (
                            <div 
                              className="max-w-xs truncate text-gray-600 text-xs bg-gray-50 p-2 rounded cursor-pointer hover:bg-gray-100"
                              title={item.contentPreview}
                            >
                              {item.contentPreview}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {item.companyName || item.fullName || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {item.amount || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {item.date || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {item.phone || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm space-x-2">
                          <button
                            onClick={() => setSelectedDocument(item)}
                            className="text-blue-600 hover:text-blue-900"
                            title="צפייה"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => setExtractedData(prev => prev.filter(i => i.id !== item.id))}
                            className="text-red-600 hover:text-red-900"
                            title="מחיקה"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* סטטיסטיקות */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-blue-500 text-white">
                    <FileText size={24} />
                  </div>
                  <div className="mr-4">
                    <p className="text-sm font-medium text-gray-600">סה״כ מסמכים</p>
                    <p className="text-2xl font-semibold text-gray-900">{extractedData.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-green-500 text-white">
                    <FileText size={24} />
                  </div>
                  <div className="mr-4">
                    <p className="text-sm font-medium text-gray-600">חשבוניות</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {extractedData.filter(item => item.category === 'חשבוניות').length}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-teal-500 text-white">
                    <FileText size={24} />
                  </div>
                  <div className="mr-4">
                    <p className="text-sm font-medium text-gray-600">מסמכי זהות</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {extractedData.filter(item => item.category === 'תעודת זהות').length}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-purple-500 text-white">
                    <FileText size={24} />
                  </div>
                  <div className="mr-4">
                    <p className="text-sm font-medium text-gray-600">מסוננים</p>
                    <p className="text-2xl font-semibold text-gray-900">{filteredData.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* מודל צפייה */}
        {selectedDocument && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSelectedDocument(null)}>
            <div className="bg-white rounded-lg max-w-4xl max-h-[80vh] overflow-y-auto p-6 m-4" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">פרטי מסמך: {selectedDocument.fileName}</h3>
                <button onClick={() => setSelectedDocument(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div><strong>קטגוריה:</strong> {selectedDocument.category}</div>
                <div><strong>תאריך העלאה:</strong> {selectedDocument.uploadDate}</div>
                {selectedDocument.companyName && <div><strong>שם חברה:</strong> {selectedDocument.companyName}</div>}
                {selectedDocument.fullName && <div><strong>שם מלא:</strong> {selectedDocument.fullName}</div>}
                {selectedDocument.amount && <div><strong>סכום:</strong> {selectedDocument.amount}</div>}
                {selectedDocument.date && <div><strong>תאריך:</strong> {selectedDocument.date}</div>}
                {selectedDocument.phone && <div><strong>טלפון:</strong> {selectedDocument.phone}</div>}
                {selectedDocument.email && <div><strong>אימייל:</strong> {selectedDocument.email}</div>}
                {selectedDocument.idNumber && <div><strong>מספר זהות:</strong> {selectedDocument.idNumber}</div>}
              </div>
              
              <div>
                <strong>תוכן המסמך:</strong>
                <div className="mt-2 p-4 bg-gray-50 rounded-lg max-h-60 overflow-y-auto text-sm">
                  {selectedDocument.content || 'לא ניתן להציג תוכן'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentDataExtractor;