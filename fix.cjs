const fs = require('fs');
let c = fs.readFileSync('src/pages/HodDashboard.jsx', 'utf8');

c = c.replaceAll('className=\"rounded-2xl border border-red-100 bg-red-50/40 p-5 space-y-4\"', 'className=\"rounded-2xl border-2 border-red-200/80 bg-red-50/40 p-5 space-y-4 shadow-sm hover:border-red-300 transition-colors\"');
c = c.replaceAll('className=\"rounded-2xl border border-orange-100 bg-orange-50/40 p-5 space-y-4\"', 'className=\"rounded-2xl border-2 border-orange-200/80 bg-orange-50/40 p-5 space-y-4 shadow-sm hover:border-orange-300 transition-colors\"');
c = c.replaceAll('className=\"rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5 space-y-4\"', 'className=\"rounded-2xl border-2 border-indigo-200/80 bg-indigo-50/40 p-5 space-y-4 shadow-sm hover:border-indigo-300 transition-colors\"');
c = c.replaceAll('className=\"p-6 bg-blue-50/50 rounded-3xl border border-blue-100 space-y-5\"', 'className=\"p-6 bg-blue-50/50 rounded-3xl border-2 border-blue-200/80 space-y-5 shadow-sm hover:border-blue-300 transition-colors\"');

c = c.replaceAll('className=\"w-full pl-10 pr-4 py-2 border border-slate-200/80 rounded-xl', 'className=\"w-full pl-10 pr-4 py-2 border-2 border-slate-300 rounded-xl');

c = c.replaceAll('shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-slate-200/50', 'shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-2 border-slate-300');
c = c.replaceAll('bg-slate-50 p-2 rounded-2xl border border-slate-200/60', 'bg-slate-50 p-2 rounded-2xl border-2 border-slate-300');

c = c.replaceAll('text-slate-500 hover:text-slate-800 hover:bg-slate-200/50', 'text-slate-500 hover:text-violet-600 hover:bg-white hover:shadow-sm hover:scale-[1.02] hover:ring-1 hover:ring-slate-200');

c = c.replaceAll('text-slate-300 hover:text-indigo-600 hover:bg-indigo-50', 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 hover:shadow-sm hover:border-indigo-200');
c = c.replaceAll('text-slate-300 hover:text-red-600 hover:bg-red-50', 'text-slate-400 hover:text-red-600 hover:bg-red-50 hover:shadow-sm hover:border-red-200');
c = c.replaceAll('text-slate-300 hover:text-orange-600 hover:bg-orange-50', 'text-slate-400 hover:text-orange-600 hover:bg-orange-50 hover:shadow-sm hover:border-orange-200');

fs.writeFileSync('src/pages/HodDashboard.jsx', c);
