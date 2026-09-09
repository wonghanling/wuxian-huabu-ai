import { NextResponse } from 'next/server';
import { azureEnabled, azureUrl } from '@/lib/azure-storage';

// ============================================================
// 存储配置自检（临时诊断用，问题定位后可删）
//
// 用来回答一个问题：服务端到底读不读得到 AZURE_STORAGE_CONNECTION_STRING。
// 之前靠"看产出的 URL 落在哪"来反推，但那要走完整条生成链路，慢且间接 ——
// 代码正确、部署完成，产出却仍落 Supabase 时，只剩"环境变量没生效"一种解释，
// 这个接口能直接证实或否证它。
//
// 不返回密钥本身，只返回长度与前缀，避免泄露。
// ============================================================

export async function GET() {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;

  return NextResponse.json({
    azureEnabled: azureEnabled(),
    connString: conn
      ? {
          present: true,
          length: conn.length,
          // 只露账户名部分，足够确认是不是填对了那一串
          accountName: conn.match(/AccountName=([^;]+)/)?.[1] ?? '(解析不出)',
          hasKey: /AccountKey=.{20,}/.test(conn),
        }
      : { present: false },
    sampleUrl: azureUrl('images/probe/test.jpg'),
    // 这两个用于确认是否命中同一份部署
    nodeEnv: process.env.NODE_ENV,
    时间: new Date().toISOString(),
  });
}
