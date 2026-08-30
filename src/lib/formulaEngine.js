// ============================================================
// Sandboxed payroll formula engine (Formula Engine v2)
//
// Replaces the previous `new Function(...)` evaluator, which executed
// arbitrary JavaScript. This engine parses a restricted expression
// grammar into an AST and interprets it against a whitelist:
//
//   literals:   numbers, single/double-quoted strings, true/false
//   operators:  + - * / % ( )  == != === !== > >= < <=  && || !  ?:
//   identifiers: only variables provided in the context
//   calls:      only functions registered in FUNCTIONS (or ctx.functions)
//
// Forbidden by construction: property access, indexing, assignment,
// `new`, lambdas, template strings, prototype escape routes.
// Execution is capped by MAX_STEPS to prevent pathological formulas.
// ============================================================

const MAX_STEPS = 10000;

export class FormulaError extends Error {
  constructor(message, position) {
    super(position != null ? `${message} (at position ${position})` : message);
    this.name = 'FormulaError';
    this.position = position;
  }
}

// ---------- Tokenizer ----------

const TWO_CHAR_OPS = ['==', '!=', '>=', '<=', '&&', '||'];
const THREE_CHAR_OPS = ['===', '!=='];

function tokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }

    // numbers (incl. decimals)
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1]))) {
      let j = i;
      while (j < src.length && /[0-9._]/.test(src[j])) j++;
      const raw = src.slice(i, j).replace(/_/g, '');
      const value = Number(raw);
      if (Number.isNaN(value)) throw new FormulaError(`Invalid number '${raw}'`, i);
      tokens.push({ type: 'number', value, pos: i });
      i = j;
      continue;
    }

    // strings
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      let out = '';
      while (j < src.length && src[j] !== ch) {
        if (src[j] === '\\') { out += src[j + 1]; j += 2; }
        else { out += src[j]; j++; }
      }
      if (j >= src.length) throw new FormulaError('Unterminated string', i);
      tokens.push({ type: 'string', value: out, pos: i });
      i = j + 1;
      continue;
    }

    // identifiers / keywords
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      const word = src.slice(i, j);
      if (word === 'true') tokens.push({ type: 'boolean', value: true, pos: i });
      else if (word === 'false') tokens.push({ type: 'boolean', value: false, pos: i });
      else if (word === 'null') tokens.push({ type: 'null', value: null, pos: i });
      else tokens.push({ type: 'identifier', value: word, pos: i });
      i = j;
      continue;
    }

    // operators
    const three = src.slice(i, i + 3);
    if (THREE_CHAR_OPS.includes(three)) { tokens.push({ type: 'op', value: three === '===' ? '==' : '!=', pos: i }); i += 3; continue; }
    const two = src.slice(i, i + 2);
    if (TWO_CHAR_OPS.includes(two)) { tokens.push({ type: 'op', value: two, pos: i }); i += 2; continue; }
    if ('+-*/%()<>!?:,'.includes(ch)) { tokens.push({ type: 'op', value: ch, pos: i }); i++; continue; }

    // explicitly reject the dangerous stuff with a clear message
    if (ch === '.' || ch === '[' || ch === ']' || ch === '=' || ch === '{' || ch === '}' || ch === '`' || ch === ';') {
      throw new FormulaError(`Character '${ch}' is not allowed in formulas`, i);
    }
    throw new FormulaError(`Unexpected character '${ch}'`, i);
  }
  return tokens;
}

// ---------- Parser (precedence climbing) ----------

function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const expectOp = v => {
    const t = next();
    if (!t || t.type !== 'op' || t.value !== v) {
      throw new FormulaError(`Expected '${v}'`, t?.pos);
    }
  };

  function parseExpression() { return parseTernary(); }

  function parseTernary() {
    const cond = parseOr();
    if (peek()?.type === 'op' && peek().value === '?') {
      next();
      const t = parseExpression();
      expectOp(':');
      const f = parseExpression();
      return { kind: 'ternary', cond, t, f };
    }
    return cond;
  }

  function parseOr() {
    let left = parseAnd();
    while (peek()?.type === 'op' && peek().value === '||') { next(); left = { kind: 'or', left, right: parseAnd() }; }
    return left;
  }

  function parseAnd() {
    let left = parseComparison();
    while (peek()?.type === 'op' && peek().value === '&&') { next(); left = { kind: 'and', left, right: parseComparison() }; }
    return left;
  }

  function parseComparison() {
    let left = parseAdditive();
    while (peek()?.type === 'op' && ['==', '!=', '>', '>=', '<', '<='].includes(peek().value)) {
      const op = next().value;
      left = { kind: 'cmp', op, left, right: parseAdditive() };
    }
    return left;
  }

  function parseAdditive() {
    let left = parseMultiplicative();
    while (peek()?.type === 'op' && ['+', '-'].includes(peek().value)) {
      const op = next().value;
      left = { kind: 'arith', op, left, right: parseMultiplicative() };
    }
    return left;
  }

  function parseMultiplicative() {
    let left = parseUnary();
    while (peek()?.type === 'op' && ['*', '/', '%'].includes(peek().value)) {
      const op = next().value;
      left = { kind: 'arith', op, left, right: parseUnary() };
    }
    return left;
  }

  function parseUnary() {
    const t = peek();
    if (t?.type === 'op' && t.value === '-') { next(); return { kind: 'neg', arg: parseUnary() }; }
    if (t?.type === 'op' && t.value === '+') { next(); return parseUnary(); }
    if (t?.type === 'op' && t.value === '!') { next(); return { kind: 'not', arg: parseUnary() }; }
    return parsePrimary();
  }

  function parsePrimary() {
    const t = next();
    if (!t) throw new FormulaError('Unexpected end of formula');
    if (t.type === 'number' || t.type === 'string' || t.type === 'boolean' || t.type === 'null') {
      return { kind: 'literal', value: t.value };
    }
    if (t.type === 'op' && t.value === '(') {
      const inner = parseExpression();
      expectOp(')');
      return inner;
    }
    if (t.type === 'identifier') {
      // function call?
      if (peek()?.type === 'op' && peek().value === '(') {
        next();
        const args = [];
        if (!(peek()?.type === 'op' && peek().value === ')')) {
          args.push(parseExpression());
          while (peek()?.type === 'op' && peek().value === ',') { next(); args.push(parseExpression()); }
        }
        expectOp(')');
        return { kind: 'call', name: t.value, args, pos: t.pos };
      }
      return { kind: 'var', name: t.value, pos: t.pos };
    }
    throw new FormulaError(`Unexpected token '${t.value}'`, t.pos);
  }

  const ast = parseExpression();
  if (pos < tokens.length) throw new FormulaError(`Unexpected token '${tokens[pos].value}'`, tokens[pos].pos);
  return ast;
}

// ---------- Function library (whitelist) ----------

function num(v) { const n = Number(v); return Number.isNaN(n) ? 0 : n; }

function roundTo(value, decimals = 0, mode = 'half_up') {
  const f = Math.pow(10, decimals);
  const x = num(value) * f;
  let r;
  switch (mode) {
    case 'ceil': r = Math.ceil(x); break;
    case 'floor': r = Math.floor(x); break;
    case 'half_down': r = -Math.round(-x); break;
    default: r = Math.round(x);
  }
  return r / f;
}

function toDate(v) {
  if (v instanceof Date) return v;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new FormulaError(`Invalid date '${v}'`);
  return d;
}

export const FUNCTIONS = {
  IF: (cond, t, f) => (cond ? t : f),
  ROUND: (v, d = 0) => roundTo(v, num(d), 'half_up'),
  ROUNDUP: (v, d = 0) => roundTo(v, num(d), 'ceil'),
  ROUNDDOWN: (v, d = 0) => roundTo(v, num(d), 'floor'),
  MIN: (...args) => Math.min(...args.map(num)),
  MAX: (...args) => Math.max(...args.map(num)),
  ABS: v => Math.abs(num(v)),
  FLOOR: v => Math.floor(num(v)),
  CEIL: v => Math.ceil(num(v)),
  SUM: (...args) => args.reduce((a, b) => a + num(b), 0),
  AVG: (...args) => (args.length ? args.reduce((a, b) => a + num(b), 0) / args.length : 0),
  POWER: (a, b) => Math.pow(num(a), num(b)),
  PRORATE: (amount, paidDays, workingDays) =>
    num(workingDays) === 0 ? 0 : (num(amount) * num(paidDays)) / num(workingDays),
  DATEDIFF: (d1, d2, unit = 'days') => {
    const a = toDate(d1), b = toDate(d2);
    const ms = b.getTime() - a.getTime();
    const days = ms / 86400000;
    const u = String(unit).toLowerCase();
    if (u.startsWith('y')) return days / 365.25;
    if (u.startsWith('m')) return days / 30.4375;
    return days;
  },
  YEARFRAC: (d1, d2) => {
    const a = toDate(d1), b = toDate(d2);
    return (b.getTime() - a.getTime()) / 86400000 / 365.25;
  },
  CONCAT: (...args) => args.map(a => (a == null ? '' : String(a))).join(''),
  ISBLANK: v => v == null || v === '',
};

// ---------- Interpreter ----------

function interpret(node, variables, functions, state) {
  if (++state.steps > MAX_STEPS) throw new FormulaError('Formula exceeded execution limit');
  switch (node.kind) {
    case 'literal': return node.value;
    case 'var': {
      if (Object.prototype.hasOwnProperty.call(variables, node.name)) return variables[node.name];
      throw new FormulaError(`Unknown variable '${node.name}'`, node.pos);
    }
    case 'neg': return -num(interpret(node.arg, variables, functions, state));
    case 'not': return !interpret(node.arg, variables, functions, state);
    case 'and': return interpret(node.left, variables, functions, state) && interpret(node.right, variables, functions, state);
    case 'or': return interpret(node.left, variables, functions, state) || interpret(node.right, variables, functions, state);
    case 'ternary':
      return interpret(node.cond, variables, functions, state)
        ? interpret(node.t, variables, functions, state)
        : interpret(node.f, variables, functions, state);
    case 'cmp': {
      const l = interpret(node.left, variables, functions, state);
      const r = interpret(node.right, variables, functions, state);
      switch (node.op) {
        case '==': return l === r || (num(l) === num(r) && typeof l !== 'string' && typeof r !== 'string') || String(l) === String(r);
        case '!=': return !(l === r || String(l) === String(r));
        case '>': return num(l) > num(r);
        case '>=': return num(l) >= num(r);
        case '<': return num(l) < num(r);
        case '<=': return num(l) <= num(r);
        default: throw new FormulaError(`Unknown operator '${node.op}'`);
      }
    }
    case 'arith': {
      const l = interpret(node.left, variables, functions, state);
      const r = interpret(node.right, variables, functions, state);
      switch (node.op) {
        case '+': return (typeof l === 'string' || typeof r === 'string') ? String(l) + String(r) : num(l) + num(r);
        case '-': return num(l) - num(r);
        case '*': return num(l) * num(r);
        case '/': return num(r) === 0 ? 0 : num(l) / num(r);
        case '%': return num(r) === 0 ? 0 : num(l) % num(r);
        default: throw new FormulaError(`Unknown operator '${node.op}'`);
      }
    }
    case 'call': {
      const fn = functions[node.name];
      if (typeof fn !== 'function') throw new FormulaError(`Unknown function '${node.name}'`, node.pos);
      const args = node.args.map(a => interpret(a, variables, functions, state));
      return fn(...args);
    }
    default:
      throw new FormulaError('Invalid formula structure');
  }
}

// ---------- Public API ----------

const astCache = new Map();

export function parseFormula(expression) {
  if (astCache.has(expression)) return astCache.get(expression);
  const ast = parse(tokenize(expression));
  if (astCache.size > 500) astCache.clear();
  astCache.set(expression, ast);
  return ast;
}

// Validates syntax and returns the variables/functions the formula references.
export function analyzeFormula(expression) {
  const ast = parse(tokenize(String(expression)));
  const variables = new Set();
  const functions = new Set();
  (function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.kind === 'var') variables.add(node.name);
    if (node.kind === 'call') { functions.add(node.name); node.args.forEach(walk); }
    for (const key of ['cond', 't', 'f', 'left', 'right', 'arg']) if (node[key]) walk(node[key]);
  })(ast);
  return { valid: true, variables: [...variables], functions: [...functions] };
}

// Evaluate a formula against variables + optional extra functions
// (e.g. LOOKUP bound to country statutory rules). Throws FormulaError.
export function evaluateExpression(expression, variables = {}, extraFunctions = {}) {
  const ast = parseFormula(String(expression));
  const fns = { ...FUNCTIONS, ...extraFunctions };
  return interpret(ast, variables, fns, { steps: 0 });
}

// Legacy-compatible wrapper: returns null on any error, rounds numeric
// results to 3 decimals (matches the old evaluateFormula behavior).
export function safeEvaluate(expression, variables = {}, extraFunctions = {}) {
  try {
    const result = evaluateExpression(expression, variables, extraFunctions);
    return typeof result === 'number' ? Math.round(result * 1000) / 1000 : result;
  } catch {
    return null;
  }
}
