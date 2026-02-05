import Link from 'next/link';
import { Infinity, Sparkles } from 'lucide-react';

export default function Home() {
  return (
    <div className="relative bg-[#09090b] text-white overflow-hidden">
      {/* Animated Grid Background */}
      <div className="infinite-grid absolute inset-0 opacity-50" />

      {/* Glowing Orbs */}
      <div className="orb orb-blue" />
      <div className="orb orb-purple" />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-zinc-950/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <img src="/logo-transparent.png" alt="BOLUO.1971" className="w-8 h-8" />
            <span className="font-semibold text-lg tracking-tight">BOLUO.1971</span>
          </div>

          <div className="hidden md:flex space-x-8 text-sm text-zinc-400 font-medium">
            <a href="#" className="hover:text-white transition-colors flex flex-col items-center">
              <span>Platform</span>
              <span className="text-xs text-zinc-500">平台</span>
            </a>
            <a href="#" className="hover:text-white transition-colors flex flex-col items-center">
              <span>Showcase</span>
              <span className="text-xs text-zinc-500">案例展示</span>
            </a>
            <a href="#" className="hover:text-white transition-colors flex flex-col items-center">
              <span>Enterprise</span>
              <span className="text-xs text-zinc-500">企业版</span>
            </a>
            <a href="#" className="hover:text-white transition-colors flex flex-col items-center">
              <span>Pricing</span>
              <span className="text-xs text-zinc-500">定价</span>
            </a>
          </div>

          <div className="flex items-center space-x-4">
            <button className="text-sm font-medium text-zinc-400 hover:text-white transition-colors flex flex-col items-center">
              <span>Log in</span>
              <span className="text-xs text-zinc-500">登录</span>
            </button>
            <button className="px-4 py-2 text-sm font-semibold rounded-full btn-primary flex flex-col items-center">
              <span>Sign up</span>
              <span className="text-xs">注册</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative pt-32 pb-20 px-6 flex flex-col items-center">
        <div className="relative z-10 max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center px-3 py-1 rounded-full border border-white/10 bg-white/5 mb-8 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-blue-500 mr-2 animate-pulse"></span>
            <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Now in Private Beta <span className="text-zinc-500">/ 内测中</span></span>
          </div>

          <h1 className="text-6xl md:text-8xl font-bold tracking-tighter hero-text leading-[1.1] mb-4">
            The AI workspace for <br/> <span className="italic">infinite</span> creative flow.
          </h1>
          <p className="text-2xl md:text-3xl text-zinc-500 mb-8">
            为<span className="text-zinc-300">无限创作流</span>而生的 AI 工作空间
          </p>

          <p className="max-w-2xl mx-auto text-lg md:text-xl text-zinc-400 leading-relaxed mb-3">
            A non-linear canvas designed for high-performance teams. Brainstorm, design, and prototype with AI agents that live directly inside your workflow.
          </p>
          <p className="max-w-2xl mx-auto text-base md:text-lg text-zinc-500 leading-relaxed mb-12">
            一个为高效团队打造的非线性画布。<br/>
            在你的工作流中，直接与 AI 智能体协作，完成头脑风暴、设计与原型构建。
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <Link href="/canvas">
              <button className="px-8 py-4 rounded-full font-semibold btn-primary text-base min-w-[200px] flex flex-col items-center">
                <span>Try the Infinite Canvas</span>
                <span className="text-xs opacity-80">体验无限画布</span>
              </button>
            </Link>
          </div>

          {/* Dashboard Preview */}
          <div className="text-center mb-6">
            <h3 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 mb-2">
              随心拖拽 · 无限扩展 · 创意无限延伸 · 自由连接 · 高自由度创作
            </h3>
            <p className="text-sm md:text-base text-zinc-500">
              Drag Freely · Expand Infinitely · Extend Creativity · Connect Freely · Ultimate Creative Freedom
            </p>
          </div>
          <div className="relative group mt-10">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-[32px] blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
            <div className="relative glass-card p-2 md:p-4 aspect-video overflow-hidden shadow-2xl">
              <div className="w-full h-full rounded-2xl bg-zinc-900 overflow-hidden relative">
                {/* Mock UI elements */}
                <div className="absolute top-4 left-4 flex space-x-2 z-10">
                  <div className="w-3 h-3 rounded-full bg-zinc-800"></div>
                  <div className="w-3 h-3 rounded-full bg-zinc-800"></div>
                  <div className="w-3 h-3 rounded-full bg-zinc-800"></div>
                </div>

                {/* Floating Toolbars */}
                <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col space-y-4 p-2 bg-zinc-800/50 rounded-xl border border-white/10 backdrop-blur-sm z-10">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-current rounded"></div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  </div>
                </div>

                {/* Canvas Cards - Randomly positioned */}
                <div className="absolute inset-0 scale-75 md:scale-90" style={{zIndex: 2}}>
                  {/* Text Card - Left, middle-bottom */}
                  <div className="absolute left-[8%] top-[45%] w-40 h-52 bg-zinc-800/80 border border-zinc-700 rounded-xl flex flex-col p-4 shadow-lg">
                    <div className="text-[10px] text-zinc-500 mb-1">Text</div>
                    <div className="text-sm font-semibold text-white mb-3">文本</div>
                    <div className="flex-1 bg-zinc-700/50 rounded-lg p-2 mb-2">
                      <div className="h-1.5 w-full bg-zinc-600 rounded mb-2"></div>
                      <div className="h-1.5 w-4/5 bg-zinc-600 rounded mb-2"></div>
                      <div className="h-1.5 w-3/5 bg-zinc-600 rounded"></div>
                    </div>
                    <div className="text-[9px] text-zinc-500 mb-1">模型:</div>
                    <div className="text-[8px] leading-relaxed">
                      <span className="text-blue-400">ChatGPT</span> · <span className="text-purple-400">Grok</span> · <span className="text-yellow-400">Gemini</span>
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-zinc-700 border-2 border-zinc-600 flex items-center justify-center z-10">
                      <span className="text-zinc-400 text-xs">+</span>
                    </div>
                  </div>

                  {/* Image Card - Center-top */}
                  <div className="absolute left-[32%] top-[15%] w-48 h-56 bg-zinc-800/80 border border-zinc-700 rounded-xl flex flex-col p-4 shadow-lg">
                    <div className="text-[10px] text-zinc-500 mb-1">Image</div>
                    <div className="text-sm font-semibold text-white mb-3">图片</div>
                    <div className="flex-1 bg-zinc-700/30 rounded-lg flex items-center justify-center mb-2">
                      <div className="w-20 h-20 bg-zinc-600/50 rounded"></div>
                    </div>
                    <div className="text-[9px] text-zinc-500 mb-1">模型:</div>
                    <div className="text-[8px] leading-relaxed">
                      <span className="text-blue-400">Nano</span> · <span className="text-purple-400">Banana Pro</span> · <span className="text-yellow-400">DALL-E</span>
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-zinc-700 border-2 border-zinc-600 flex items-center justify-center z-10">
                      <span className="text-zinc-400 text-xs">+</span>
                    </div>
                  </div>

                  {/* Video Card - Right-top */}
                  <div className="absolute right-[8%] top-[20%] w-52 h-48 bg-zinc-800/80 border border-zinc-700 rounded-xl flex flex-col p-4 shadow-lg">
                    <div className="text-[10px] text-zinc-500 mb-1">Video</div>
                    <div className="text-sm font-semibold text-white mb-3">视频</div>
                    <div className="flex-1 bg-zinc-700/30 rounded-lg flex items-center justify-center mb-2">
                      <svg className="w-10 h-10 text-zinc-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                    <div className="text-[9px] text-zinc-500 mb-1">模型:</div>
                    <div className="text-[8px] leading-relaxed">
                      <span className="text-blue-400">Sora</span> · <span className="text-purple-400">Runway</span> · <span className="text-yellow-400">Veo3</span>
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-zinc-700 border-2 border-zinc-600 flex items-center justify-center z-10">
                      <span className="text-zinc-400 text-xs">+</span>
                    </div>
                  </div>

                  {/* Image Editor Card - Center-bottom */}
                  <div className="absolute left-[38%] top-[55%] w-44 h-44 bg-zinc-800/80 border border-zinc-700 rounded-xl flex flex-col p-4 shadow-lg">
                    <div className="text-xs font-semibold text-white mb-2">图片编辑器</div>
                    <div className="flex-1 bg-zinc-700/30 rounded-lg flex items-center justify-center relative">
                      <div className="w-24 h-16 border-2 border-zinc-500 border-dashed rounded"></div>
                      <div className="absolute top-2 right-2 w-3 h-3 bg-zinc-500 rounded-full"></div>
                    </div>
                    <div className="text-[8px] text-zinc-500 mt-2">裁剪 · 缩放 · 旋转</div>
                    <div className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-zinc-700 border-2 border-zinc-600 flex items-center justify-center z-10">
                      <span className="text-zinc-400 text-xs">+</span>
                    </div>
                  </div>

                  {/* Double-click Editor Card - Right-bottom */}
                  <div className="absolute right-[10%] top-[58%] w-40 h-40 bg-zinc-800/80 border border-zinc-700 rounded-xl flex flex-col items-center justify-center p-4 shadow-lg">
                    <div className="text-xs text-center text-zinc-400 mb-2">双击打开编辑器</div>
                    <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center mb-2">
                      <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"/>
                      </svg>
                    </div>
                    <div className="text-[8px] text-zinc-500 text-center">快速编辑</div>
                    <div className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-zinc-700 border-2 border-zinc-600 flex items-center justify-center z-10">
                      <span className="text-zinc-400 text-xs">+</span>
                    </div>
                  </div>
                </div>

                {/* Drag hint */}
                <div className="absolute bottom-4 right-4 text-[10px] text-zinc-600 flex items-center gap-1 z-10">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/>
                  </svg>
                  随意拖曳 · 自由连接
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section className="py-32 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Everything you need to create
            </h2>
            <p className="text-xl text-zinc-500">
              你所需要的一切创作工具
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="glass-card p-8 hover:border-blue-500/30 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-6">
                <Infinity className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Infinite Canvas</h3>
              <p className="text-sm text-zinc-500 mb-2">无限画布</p>
              <p className="text-zinc-400 leading-relaxed">
                Unlimited space for your ideas. Drag, zoom, and organize your creative workflow without boundaries.
              </p>
              <p className="text-sm text-zinc-500 mt-2">
                为你的创意提供无限空间。自由拖拽、缩放，无边界地组织你的创作流程。
              </p>
            </div>

            {/* Feature 2 */}
            <div className="glass-card p-8 hover:border-purple-500/30 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-6">
                <Sparkles className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">AI-Powered Cards</h3>
              <p className="text-sm text-zinc-500 mb-2">AI 驱动的卡片</p>
              <p className="text-zinc-400 leading-relaxed">
                Each card is an independent AI agent. Generate images, videos, and content with custom models and parameters.
              </p>
              <p className="text-sm text-zinc-500 mt-2">
                每张卡片都是独立的 AI 智能体。使用自定义模型和参数生成图片、视频和内容。
              </p>
            </div>

            {/* Feature 3 */}
            <div className="glass-card p-8 hover:border-cyan-500/30 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-6">
                <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Card-Level Control</h3>
              <p className="text-sm text-zinc-500 mb-2">卡片级控制</p>
              <p className="text-zinc-400 leading-relaxed">
                Every card chooses its own model, parameters, and execution. No global settings, complete autonomy.
              </p>
              <p className="text-sm text-zinc-500 mt-2">
                每张卡片独立选择模型、参数和执行方式。无全局设置，完全自治。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Card Types Section */}
      <section className="py-32 border-t border-white/5 relative z-10 bg-zinc-950/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Powerful card types
            </h2>
            <p className="text-xl text-zinc-500">
              强大的卡片类型
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 bg-slate-400 border border-white/5 rounded-3xl backdrop-blur-sm">
              <div className="w-8 h-8 mb-3">
                <img src="/book-business-guidelines-svgrepo-com.svg" alt="Text Card" className="w-full h-full" />
              </div>
              <h4 className="font-semibold mb-1 text-zinc-900">Text Card</h4>
              <p className="text-xs text-zinc-700 mb-2">文本卡</p>
              <p className="text-sm text-zinc-800">Write prompts and scripts</p>
            </div>

            <div className="p-6 bg-slate-400 border border-white/5 rounded-3xl backdrop-blur-sm">
              <div className="w-8 h-8 mb-3">
                <img src="/juese-halloween-typical-character-bandaged-outline-svgrepo-com.svg" alt="Character Card" className="w-full h-full" />
              </div>
              <h4 className="font-semibold mb-1 text-zinc-900">Character Card</h4>
              <p className="text-xs text-zinc-700 mb-2">角色卡</p>
              <p className="text-sm text-zinc-800">Create detailed characters</p>
            </div>

            <div className="p-6 bg-slate-400 border border-white/5 rounded-3xl backdrop-blur-sm">
              <div className="w-8 h-8 mb-3">
                <img src="/tupian-landscape-png-svgrepo-com.svg" alt="Image Generate" className="w-full h-full" />
              </div>
              <h4 className="font-semibold mb-1 text-zinc-900">Image Generate</h4>
              <p className="text-xs text-zinc-700 mb-2">图片生成</p>
              <p className="text-sm text-zinc-800">Text to image with AI</p>
            </div>

            <div className="p-6 bg-slate-400 border border-white/5 rounded-3xl backdrop-blur-sm">
              <div className="w-8 h-8 mb-3">
                <img src="/jingtou-film-svgrepo-com.svg" alt="Shot Grid" className="w-full h-full" />
              </div>
              <h4 className="font-semibold mb-1 text-zinc-900">Shot Grid</h4>
              <p className="text-xs text-zinc-700 mb-2">多镜头</p>
              <p className="text-sm text-zinc-800">Multiple camera angles</p>
            </div>

            <div className="p-6 bg-slate-400 border border-white/5 rounded-3xl backdrop-blur-sm">
              <div className="w-8 h-8 mb-3">
                <img src="/jiandao-svgrepo-com.svg" alt="Crop Card" className="w-full h-full" />
              </div>
              <h4 className="font-semibold mb-1 text-zinc-900">Crop Card</h4>
              <p className="text-xs text-zinc-700 mb-2">裁剪卡</p>
              <p className="text-sm text-zinc-800">Crop and resize images</p>
            </div>

            <div className="p-6 bg-slate-400 border border-white/5 rounded-3xl backdrop-blur-sm">
              <div className="w-8 h-8 mb-3">
                <img src="/bianhuanka-camera-svgrepo-com.svg" alt="Transform" className="w-full h-full" />
              </div>
              <h4 className="font-semibold mb-1 text-zinc-900">Transform</h4>
              <p className="text-xs text-zinc-700 mb-2">变换卡</p>
              <p className="text-sm text-zinc-800">Rotate, scale, and flip</p>
            </div>

            <div className="p-6 bg-slate-400 border border-white/5 rounded-3xl backdrop-blur-sm">
              <div className="w-8 h-8 mb-3">
                <img src="/shipingshengchen-camera-filled-svgrepo-com.svg" alt="Video Generate" className="w-full h-full" />
              </div>
              <h4 className="font-semibold mb-1 text-zinc-900">Video Generate</h4>
              <p className="text-xs text-zinc-700 mb-2">视频生成</p>
              <p className="text-sm text-zinc-800">Create AI videos</p>
            </div>

            <div className="p-6 bg-slate-400 border border-white/5 rounded-3xl backdrop-blur-sm">
              <div className="w-8 h-8 mb-3">
                <img src="/zijing-svgrepo-com.svg" alt="Asset Card" className="w-full h-full" />
              </div>
              <h4 className="font-semibold mb-1 text-zinc-900">Asset Card</h4>
              <p className="text-xs text-zinc-700 mb-2">资产卡</p>
              <p className="text-sm text-zinc-800">Manage your assets</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-32 border-t border-white/5 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              How it works
            </h2>
            <p className="text-xl text-zinc-500">
              工作原理
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {/* Step 1 */}
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                <span className="text-xl font-bold text-blue-400">1</span>
              </div>
              <div className="glass-card p-8 pt-12">
                <h3 className="text-xl font-semibold mb-2">Drag & Drop Cards</h3>
                <p className="text-sm text-zinc-500 mb-4">拖拽卡片</p>
                <p className="text-zinc-400 leading-relaxed">
                  Choose from our card library and drag them onto your infinite canvas. Each card is a building block for your creative workflow.
                </p>
                <p className="text-sm text-zinc-500 mt-3">
                  从卡片库中选择并拖拽到无限画布上。每张卡片都是你创作流程的构建模块。
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                <span className="text-xl font-bold text-purple-400">2</span>
              </div>
              <div className="glass-card p-8 pt-12">
                <h3 className="text-xl font-semibold mb-2">Configure & Connect</h3>
                <p className="text-sm text-zinc-500 mb-4">配置与连接</p>
                <p className="text-zinc-400 leading-relaxed">
                  Set up each card with its own AI model, parameters, and inputs. Connect cards to reference outputs from other cards.
                </p>
                <p className="text-sm text-zinc-500 mt-3">
                  为每张卡片设置专属的 AI 模型、参数和输入。连接卡片以引用其他卡片的输出。
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
                <span className="text-xl font-bold text-cyan-400">3</span>
              </div>
              <div className="glass-card p-8 pt-12">
                <h3 className="text-xl font-semibold mb-2">Run & Create</h3>
                <p className="text-sm text-zinc-500 mb-4">运行与创作</p>
                <p className="text-zinc-400 leading-relaxed">
                  Click Run on any card to execute it independently. Results appear directly on the card, ready to use in your next step.
                </p>
                <p className="text-sm text-zinc-500 mt-3">
                  点击任意卡片的运行按钮独立执行。结果直接显示在卡片上，随时用于下一步创作。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 border-t border-white/5 relative z-10 bg-zinc-950/50">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-3xl"></div>
            <div className="relative glass-card p-12 md:p-16">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                Ready to start creating?
              </h2>
              <p className="text-xl text-zinc-500 mb-8">
                准备开始创作了吗？
              </p>
              <p className="text-lg text-zinc-400 mb-10 max-w-2xl mx-auto">
                Join thousands of creators using BOLUO.1971 to bring their ideas to life with AI-powered workflows.
              </p>
              <p className="text-sm text-zinc-500 mb-10 max-w-2xl mx-auto">
                加入数千名创作者，使用 BOLUO.1971 通过 AI 驱动的工作流将创意变为现实。
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/canvas">
                  <button className="px-10 py-5 rounded-full font-semibold btn-primary text-lg min-w-[240px] flex flex-col items-center">
                    <span>Get Started Free</span>
                    <span className="text-sm opacity-80">免费开始</span>
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-24 border-t border-white/5 relative z-10 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-2">Trusted by builders at</p>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600 mb-12">受到这些团队的信赖</p>
          <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-40 grayscale contrast-125">
            <span className="text-2xl font-bold tracking-tighter">VERCEL</span>
            <span className="text-2xl font-bold tracking-tighter">LINEAR</span>
            <span className="text-2xl font-bold tracking-tighter">RAILWAY</span>
            <span className="text-2xl font-bold tracking-tighter">STRIPE</span>
            <span className="text-2xl font-bold tracking-tighter">REPLICATE</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center space-x-2 mb-4">
                <img src="/logo-transparent.png" alt="BOLUO.1971" className="w-8 h-8" />
                <span className="font-semibold text-lg">BOLUO.1971</span>
              </div>
              <p className="text-sm text-zinc-500 leading-relaxed">
                The infinite canvas for AI-powered creative workflows.
              </p>
              <p className="text-xs text-zinc-600 mt-2">
                AI 驱动的无限创作画布
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="font-semibold mb-4 text-sm">Product <span className="text-xs text-zinc-500">产品</span></h4>
              <ul className="space-y-3 text-sm text-zinc-400">
                <li><a href="#" className="hover:text-white transition-colors">Features <span className="text-xs text-zinc-600">功能</span></a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing <span className="text-xs text-zinc-600">定价</span></a></li>
                <li><a href="#" className="hover:text-white transition-colors">Roadmap <span className="text-xs text-zinc-600">路线图</span></a></li>
                <li><a href="#" className="hover:text-white transition-colors">Changelog <span className="text-xs text-zinc-600">更新日志</span></a></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="font-semibold mb-4 text-sm">Resources <span className="text-xs text-zinc-500">资源</span></h4>
              <ul className="space-y-3 text-sm text-zinc-400">
                <li><a href="#" className="hover:text-white transition-colors">Documentation <span className="text-xs text-zinc-600">文档</span></a></li>
                <li><a href="#" className="hover:text-white transition-colors">Tutorials <span className="text-xs text-zinc-600">教程</span></a></li>
                <li><a href="#" className="hover:text-white transition-colors">Templates <span className="text-xs text-zinc-600">模板</span></a></li>
                <li><a href="#" className="hover:text-white transition-colors">Community <span className="text-xs text-zinc-600">社区</span></a></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="font-semibold mb-4 text-sm">Company <span className="text-xs text-zinc-500">公司</span></h4>
              <ul className="space-y-3 text-sm text-zinc-400">
                <li><a href="#" className="hover:text-white transition-colors">About <span className="text-xs text-zinc-600">关于</span></a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog <span className="text-xs text-zinc-600">博客</span></a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers <span className="text-xs text-zinc-600">招聘</span></a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact <span className="text-xs text-zinc-600">联系</span></a></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-zinc-500">
              © 2026 BOLUO.1971. All rights reserved. <span className="text-xs text-zinc-600">保留所有权利</span>
            </p>
            <div className="flex items-center space-x-6 text-sm text-zinc-500">
              <a href="#" className="hover:text-white transition-colors">Privacy <span className="text-xs text-zinc-600">隐私</span></a>
              <a href="#" className="hover:text-white transition-colors">Terms <span className="text-xs text-zinc-600">条款</span></a>
              <a href="#" className="hover:text-white transition-colors">Cookies <span className="text-xs text-zinc-600">Cookie</span></a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
