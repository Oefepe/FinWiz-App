import { View, Text } from 'react-native';

interface SimpleMarkdownProps {
  content: string;
}

/** Renders a subset of Markdown: h1-h3, bold lines, bullet lists, paragraphs. */
export function SimpleMarkdown({ content }: SimpleMarkdownProps) {
  const lines = content.split('\n');

  return (
    <View>
      {lines.map((line, i) => {
        if (line.startsWith('### ')) {
          return (
            <Text key={i} className="text-base font-semibold text-gray-800 mt-3 mb-1">
              {line.slice(4)}
            </Text>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <Text key={i} className="text-lg font-semibold text-gray-900 mt-4 mb-1">
              {line.slice(3)}
            </Text>
          );
        }
        if (line.startsWith('# ')) {
          return (
            <Text key={i} className="text-xl font-bold text-gray-900 mt-4 mb-2">
              {line.slice(2)}
            </Text>
          );
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <View key={i} className="flex-row mb-1 pl-2">
              <Text className="text-gray-500 mr-2">•</Text>
              <Text className="text-sm text-gray-700 flex-1">{line.slice(2)}</Text>
            </View>
          );
        }
        if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
          return (
            <Text key={i} className="text-sm font-bold text-gray-800 mb-1">
              {line.slice(2, -2)}
            </Text>
          );
        }
        if (line.trim() === '') {
          return <View key={i} className="h-2" />;
        }
        return (
          <Text key={i} className="text-sm text-gray-700 mb-1 leading-5">
            {line}
          </Text>
        );
      })}
    </View>
  );
}
