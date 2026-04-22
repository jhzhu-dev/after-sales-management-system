#!/usr/bin/env python
import os
import sys

directories = [
    r'D:\py_project\manger\openspec\specs\release-library',
    r'D:\py_project\manger\openspec\specs\knowledge-base',
    r'D:\py_project\manger\openspec\specs\device-bundles',
    r'D:\py_project\manger\openspec\specs\device-documents',
    r'D:\py_project\manger\openspec\changes\archive\2026-04-17-add-release-product-model-filter\specs\release-library',
    r'D:\py_project\manger\openspec\changes\archive\2026-03-19-add-knowledge-base\specs\knowledge-base',
    r'D:\py_project\manger\openspec\changes\archive\2026-03-25-add-device-document-batch\specs\device-documents',
    r'D:\py_project\manger\openspec\changes\archive\2026-03-27-add-device-bundles\specs\device-bundles',
    r'D:\py_project\manger\openspec\changes\archive\2026-04-16-add-device-notes\specs\devices',
    r'D:\py_project\manger\openspec\changes\archive\2026-04-16-add-custom-module-name\specs\issues',
    r'D:\py_project\manger\openspec\changes\archive\2026-04-18-add-document-preview\specs\release-library',
    r'D:\py_project\manger\openspec\changes\archive\2026-04-18-add-infinite-scroll\specs\ui-datatable'
]

success_count = 0
failed_count = 0

for directory in directories:
    try:
        os.makedirs(directory, exist_ok=True)
        print(f'✓ Created: {directory}')
        success_count += 1
    except Exception as e:
        print(f'✗ Failed: {directory} - {e}')
        failed_count += 1

print(f'\n{success_count} directories created successfully, {failed_count} failed')
sys.exit(0 if failed_count == 0 else 1)
