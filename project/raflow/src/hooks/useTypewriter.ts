import { useEffect, useState, useRef } from "react";

/**
 * 打字机效果 Hook 配置
 */
interface UseTypewriterOptions {
  /** 每个字符的延迟时间 (ms)，默认 30 */
  charDelay?: number;
  /** 是否启用打字机效果，默认 true */
  enabled?: boolean;
}

/**
 * 打字机效果 Hook 返回值
 */
interface UseTypewriterReturn {
  /** 当前显示的文本 */
  displayText: string;
  /** 是否正在打字 */
  isTyping: boolean;
}

/**
 * 打字机效果 Hook
 *
 * 逐字符显示文本，模拟打字机效果
 *
 * @param text - 要显示的完整文本
 * @param options - 配置选项
 * @returns 当前显示的文本和打字状态
 *
 * @example
 * ```tsx
 * function TypewriterText({ text }: { text: string }) {
 *   const { displayText, isTyping } = useTypewriter(text);
 *   return <span>{displayText}{isTyping && "|"}</span>;
 * }
 * ```
 */
export function useTypewriter(
  text: string,
  options: UseTypewriterOptions = {}
): UseTypewriterReturn {
  const { charDelay = 30, enabled = true } = options;
  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const previousTextRef = useRef("");

  useEffect(() => {
    if (!enabled) {
      setDisplayText(text);
      setIsTyping(false);
      return;
    }

    // 如果文本变短或完全不同，立即重置
    if (!text.startsWith(previousTextRef.current)) {
      setDisplayText("");
      previousTextRef.current = "";
    }

    // 如果文本相同，不做任何事
    if (text === displayText) {
      setIsTyping(false);
      return;
    }

    setIsTyping(true);

    // 计算需要添加的字符
    const charsToAdd = text.slice(displayText.length);
    if (charsToAdd.length === 0) {
      setIsTyping(false);
      previousTextRef.current = text;
      return;
    }

    // 添加下一个字符
    const timeoutId = setTimeout(() => {
      setDisplayText((prev) => prev + charsToAdd[0]);
    }, charDelay);

    return () => clearTimeout(timeoutId);
  }, [text, displayText, charDelay, enabled]);

  // 当 displayText 追上 text 时，更新状态
  useEffect(() => {
    if (displayText === text && isTyping) {
      setIsTyping(false);
      previousTextRef.current = text;
    }
  }, [displayText, text, isTyping]);

  return { displayText, isTyping };
}
