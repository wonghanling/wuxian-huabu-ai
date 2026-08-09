import { redirect } from 'next/navigation';

// 项目页已并入 Filmavo TV 子站，旧地址永久跳转过去
export default function ProjectsRedirect() {
  redirect('/filmavo-tv/projects');
}
