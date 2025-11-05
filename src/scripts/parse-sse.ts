import * as fs from 'fs';
import * as path from 'path';

interface SSEMessage {
  id?: string;
  data: {
    type: string;
    content?: string;
    tools?: string[];
    name?: string;
    result?: any;
    trace?: string;
    user?: any;
  };
}

function parseSseFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const messages: SSEMessage[] = [];
  let currentMessage: Partial<SSEMessage> = {};
  
  for (const line of lines) {
    if (line.startsWith('id:')) {
      if (currentMessage.data) {
        messages.push(currentMessage as SSEMessage);
      }
      currentMessage = { id: line.replace('id:', '').trim() };
    } else if (line.startsWith('data:')) {
      const dataStr = line.replace('data:', '').trim();
      try {
        currentMessage.data = JSON.parse(dataStr);
      } catch (e) {
        console.error('Error parsing data:', dataStr);
      }
    }
  }
  
  // Agregar último mensaje
  if (currentMessage.data) {
    messages.push(currentMessage as SSEMessage);
  }
  
  return messages;
}

function formatOutput(messages: SSEMessage[]) {

  
  let fullResponse = '';
  let toolsUsed: string[] = [];
  let toolResults: any[] = [];
  
  for (const msg of messages) {
    const { type, content, tools, name, result, trace, user } = msg.data;
    
    switch (type) {
      case 'tool_start':
        toolsUsed = tools || [];
        toolsUsed.forEach(tool => console.log(`   - ${tool}`));
        break;
        
      case 'tool_result':
        toolResults.push({ name, result });
        
       
        
       
        break;
        
      case 'content':
        fullResponse += content || '';
        break;
        
      case 'authenticated':
        break;
    }
  }
  

}

// Uso
const args = process.argv.slice(2);

if (args.length === 0) {
  
  process.exit(1);
}

const filePath = path.resolve(args[0]);

if (!fs.existsSync(filePath)) {
  console.error(` Archivo no encontrado: ${filePath}`);
  process.exit(1);
}

const messages = parseSseFile(filePath);
formatOutput(messages);