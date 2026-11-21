import { languages } from 'monaco-editor';

export function registerPickBasic() {
  languages.register({ id: 'pickbasic' });

  languages.setMonarchTokensProvider('pickbasic', {
    ignoreCase: true,
    keywords: [
      'CASE', 'FOR', 'NEXT', 'LOOP', 'REPEAT', 'UNTIL', 'WHILE', 
      'IF', 'THEN', 'ELSE', 'END', 'GOSUB', 'RETURN', 'CALL', 'ENTER',
      'OPEN', 'READ', 'WRITE', 'READV', 'WRITEV', 'DELETE', 'RELEASE',
      'LOCATE', 'MATREAD', 'MATWRITE', 'MAT',
      'CRT', 'PRINT', 'PRINTER', 'INPUT',
      'EXECUTE', 'CHAIN', 'PERFORM', 'SYSTEM',
      'CONVERT', 'SWAP', 'CHANGE', 'TRIM', 'FMT',
      'EXTRACT', 'INSERT', 'REPLACE', 'FIELD',
      'COUNT', 'DCOUNT', 
      'EQUATE', 'EQU', 'COMMON', 'DIM',
      'ICONV', 'OCONV',
      'SUBROUTINE', 'PROGRAM', 'FUNCTION',
      'TO', 'FROM', 'BY', 'WITH', 'STEP',
      'LOCK', 'UNLOCK',
      'PAGE', 'HEADING', 'FOOTING',
      'SLEEP', 'NAP',
      'ABORT', 'STOP', 'NULL', 'TRUE', 'FALSE',
      'BEGIN', 'BREAK', 'CONTINUE',
      'REM', 'DEBUG'
    ],
    operators: [
      '=', '>', '<', '!', '~', '?', ':',
      '==', '<=', '>=', '!=', '&&', '||', '++', '--',
      '+', '-', '*', '/', '&', '|', '^', '%', '<<', '>>', '>>>'
    ],
    symbols: /[=><!~?:&|+\-*\/\^%]+/, 
    tokenizer: {
      root: [
        // Identifiers (including dots)
        [/[a-zA-Z_][\w.]*/, {
          cases: {
            '@keywords': 'keyword',
            '@default': 'identifier'
          }
        }],
        
        { include: '@whitespace' },
        
        // Brackets
        [/[{}()[\\]]/, '@brackets'],
        
        // Operators
        [/@symbols/, {
          cases: {
            '@operators': 'operator',
            '@default': ''
          }
        }],
        
        // Numbers
        [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
        [/\d+/, 'number'],
        
        // Delimiters
        [/[;,]/, 'delimiter'],
        
        // Strings
        [/"/, { token: 'string.quote', bracket: '@open', next: '@stringDouble' }],
        [/'/, { token: 'string.quote', bracket: '@open', next: '@stringSingle' }],
        
        // Comments
        // Asterisk/Bang at start of line (allowing whitespace)
        [/^\s*[*!].*$/, 'comment'],
        // Asterisk/Bang after a semicolon (statement separator)
        [/;\s*[*!].*$/, 'comment'],
        // REM keyword
        [/REM\s.*$/, 'comment'],
        
        // Preprocessor
        [/^\s*\$([A-Za-z]+)(.*)/, 'annotation'], // $INCLUDE, $INSERT etc
      ],
      stringDouble: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
      ],
      stringSingle: [
        [/[^\\']+/, 'string'],
        [/\\./, 'string.escape'],
        [/'/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
      ],
      whitespace: [
        [/[ \t\r\n]+/, 'white'],
      ],
    },
  });

  languages.setLanguageConfiguration('pickbasic', {
    comments: {
      lineComment: '*', 
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
  });
}
