import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });

export const summarizeWikiContent = async (content: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `请为以下关于歌手黄诗扶的内容生成一段简短、优美且具有百科风格的摘要（约100-200字）：\n\n${content}`,
      config: {
        systemInstruction: "你是一个专业的音乐百科编辑，擅长用优美、客观且专业的语言描述歌手及其作品。",
      },
    });
    return response.text;
  } catch (error) {
    console.error("AI Summarization error:", error);
    return null;
  }
};

export const generateWikiIntro = async (topic: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `请为“${topic}”这个主题生成一段关于歌手黄诗扶的百科介绍开头。要求包含基本信息、艺术特色，并使用Markdown格式。`,
      config: {
        systemInstruction: "你是一个黄诗扶的资深粉丝和百科编辑，对她的音乐风格（古风、流行、戏腔等）有深入了解。",
      },
    });
    return response.text;
  } catch (error) {
    console.error("AI Generation error:", error);
    return null;
  }
};

export const describeImageForSearch = async (base64Image: string, mimeType: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
          {
            text: "请描述这张图片中的内容，特别是如果它与歌手黄诗扶、古风音乐、舞台表演或艺术作品相关。请提供几个关键词，以便我可以在数据库中搜索相关内容。请只返回关键词，用空格分隔。",
          },
        ],
      },
      config: {
        systemInstruction: "你是一个专业的图像识别助手，擅长识别与中国古风音乐、歌手黄诗扶相关的视觉元素。",
      },
    });
    return response.text;
  } catch (error) {
    console.error("AI Image Description error:", error);
    return null;
  }
};
