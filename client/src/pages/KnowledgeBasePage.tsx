import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import KnowledgeBase from '../components/KnowledgeBase';
import { productLineApi } from '../services/api';

export default function KnowledgeBasePage() {
  const [productLines, setProductLines] = useState<Array<{ id: number; name: string }>>([]);

  useEffect(() => {
    productLineApi.getProductLines({ is_active: true })
      .then(result => {
        if (result.success) setProductLines(result.data);
      })
      .catch(error => {
        console.error('获取产品线列表失败:', error);
      });
  }, []);

  return (
    <Layout>
      <div className="space-y-4 3xl:space-y-6">
        {/* 顶部标题 */}
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h1 className="text-2xl 3xl:text-3xl font-bold text-gray-900">知识库</h1>
          </div>
        </div>

        {/* 知识库内容 */}
        <KnowledgeBase productLines={productLines} />
      </div>
    </Layout>
  );
}
