import * as XLSX from 'xlsx';

export interface ExportColumn {
  key: string;
  label: string;
}

/**
 * 导出为 Excel (.xlsx) 文件，优先使用浏览器原生另存为对话框
 */
export async function exportToExcel(
  rows: Record<string, any>[],
  columns: ExportColumn[],
  defaultFilename: string
) {
  const header = columns.map(c => c.label);
  const data = rows.map(row =>
    columns.map(c => {
      const val = row[c.key];
      return val === null || val === undefined ? '' : String(val);
    })
  );

  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
  ws['!cols'] = columns.map(() => ({ wch: 22 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '数据');

  // 优先使用浏览器原生另存为对话框
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: `${defaultFilename}.xlsx`,
        types: [{
          description: 'Excel 文件',
          accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
        }]
      });
      const buffer: ArrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
      const writable = await handle.createWritable();
      await writable.write(buffer);
      await writable.close();
      return;
    } catch (e: any) {
      if (e.name === 'AbortError') return; // 用户取消
      // 降级到普通下载
    }
  }

  // 降级方案：直接触发下载
  XLSX.writeFile(wb, `${defaultFilename}.xlsx`);
}
