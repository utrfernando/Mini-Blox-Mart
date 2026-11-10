import * as XLSX from 'xlsx';
const headers = ['sku','name','description','category','supplier','supplier_cost_usd','supplier_cost','landed_cost','selling_price','discount_price','stock_quantity','low_stock_threshold','status','is_featured','is_best_seller','is_new','tags','image_urls'];
const rows = [
  ['M3038','Mini Block Ornament M3038','Collectible mini building-block ornament','Building Blocks','Shantou Chenghai Cayi Toy Co., Ltd',0.30,'','','','',10,5,'draft','no','no','yes','ornament, mini blocks','https://example.com/images/m3038.jpg'],
  ['M3040','Mini Block Ornament M3040','Collectible mini building-block ornament','Building Blocks','Shantou Chenghai Cayi Toy Co., Ltd',0.30,'','','','',45,5,'draft','no','no','yes','ornament, mini blocks',''],
  ['MZ-495','Flower Plant Block Set MZ-495','Build-it-yourself flower plant set','Flower Collections','Shantou Chenghai Cayi Toy Co., Ltd',0.50,'','','','',28,5,'draft','no','no','yes','flower, plant','https://example.com/images/mz495.jpg | https://example.com/images/mz495-2.jpg'],
];
const guide = [
 ['Column','Required?','What to enter'],
 ['sku','Recommended','Item code, e.g. M3038. Used to match existing products on re-upload. Blank = one is generated.'],
 ['name','Yes*','Product name shown in the store. *If blank, it is built from description + sku.'],
 ['description','No','Short product description.'],
 ['category','No','Category name. Created automatically if new (when the option is ticked).'],
 ['supplier','No','Supplier name. Created automatically if new.'],
 ['supplier_cost_usd','One of','Unit cost in US$. Converted using the exchange rate you type in the upload dialog.'],
 ['supplier_cost','One of','Unit cost already in your store currency (overrides supplier_cost_usd).'],
 ['landed_cost','No','Cost incl. shipping/duty in store currency. Blank = same as supplier cost.'],
 ['selling_price','Yes**','Price in store currency. **Blank is OK if you set a markup % in the upload dialog.'],
 ['discount_price','No','Sale price, must be lower than selling_price.'],
 ['stock_quantity','No','Quantity received. Recorded in inventory history.'],
 ['low_stock_threshold','No','Low-stock warning level (default 5).'],
 ['status','No','draft, published or archived (default set in the dialog).'],
 ['is_featured / is_best_seller / is_new','No','yes or no.'],
 ['tags','No','Comma-separated.'],
 ['image_urls','No','Public image links separated by | (first is the main image).'],
 [],
 ['Tip','','Supplier invoices with columns ITEM NO., DESCRIPTION OF PRODUCT, UNIT PRICE (US$), QTY can be uploaded as-is. Delete the three sample rows in the Products sheet before importing.'],
];
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
ws['!cols'] = headers.map(h => ({ wch: Math.max(14, h.length + 2) }));
XLSX.utils.book_append_sheet(wb, ws, 'Products');
const g = XLSX.utils.aoa_to_sheet(guide); g['!cols'] = [{wch:34},{wch:14},{wch:100}];
XLSX.utils.book_append_sheet(wb, g, 'Instructions');
XLSX.writeFile(wb, 'public/templates/miniblox-bulk-upload-template.xlsx');
console.log('written');
