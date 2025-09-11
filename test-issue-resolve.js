const http = require('http');

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: `/api${path}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve({ status: res.statusCode, data: result });
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testIssueResolve() {
  try {
    console.log('🧪 测试问题解决提交功能...\n');

    // 1. 获取问题列表
    console.log('📋 获取问题列表...');
    const issuesResponse = await makeRequest('GET', '/issues?page=1&limit=10');
    
    if (!issuesResponse.data.success || issuesResponse.data.data.length === 0) {
      console.log('❌ 没有找到问题');
      return;
    }

    const issues = issuesResponse.data.data;
    console.log(`✅ 找到 ${issues.length} 个问题`);

    // 找一个开放状态的问题
    const openIssue = issues.find(issue => issue.status === 'open');
    if (!openIssue) {
      console.log('❌ 没有找到开放状态的问题');
      return;
    }

    console.log(`\n🔍 选择问题: ${openIssue.id} - ${openIssue.description}`);

    // 2. 测试解决问题
    console.log('\n📝 测试解决问题...');
    const resolveData = {
      status: 'closed',
      resolution_description: '问题已通过测试解决',
      resolved_at: new Date().toISOString()
    };

    console.log('📤 发送解决数据:', JSON.stringify(resolveData, null, 2));
    const resolveResponse = await makeRequest('PUT', `/issues/${openIssue.id}`, resolveData);
    
    console.log(`📥 响应状态: ${resolveResponse.status}`);
    console.log('📥 响应数据:', JSON.stringify(resolveResponse.data, null, 2));
    
    if (resolveResponse.status === 200 && resolveResponse.data.success) {
      console.log('✅ 问题解决成功');
    } else {
      console.log('❌ 问题解决失败');
      if (resolveResponse.data.details) {
        console.log('🔍 验证错误详情:');
        resolveResponse.data.details.forEach(error => {
          console.log(`  - ${error.msg} (字段: ${error.param})`);
        });
      }
    }

    // 3. 验证问题状态
    console.log('\n🔍 验证问题状态...');
    const verifyResponse = await makeRequest('GET', `/issues/${openIssue.id}`);
    if (verifyResponse.data.success) {
      const updatedIssue = verifyResponse.data.data;
      console.log(`✅ 问题状态: ${updatedIssue.status}`);
      console.log(`✅ 解决描述: ${updatedIssue.resolution_description || '无'}`);
      console.log(`✅ 解决时间: ${updatedIssue.resolved_at || '无'}`);
    }

    console.log('\n🎉 问题解决功能测试完成！');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

testIssueResolve();
