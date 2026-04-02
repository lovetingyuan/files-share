/**
 * @react-dev-inspector/babel-plugin
 * @see https://github.com/zthxxx/react-dev-inspector/tree/master/src/plugins/babel
 * 相比原版把行数和列数信息附加到了路径后面，可以直接定位到具体代码位置
 */
import { relative } from 'path';
import { jsxAttribute, jsxIdentifier, stringLiteral } from '@babel/types';

const isNil = (value) => value === null || value === undefined;

/**
 * simple path match method, only use string and regex
 */
const pathMatch = (filePath, matches) => {
  if (!matches?.length) return false;

  return matches.some((match) => {
    if (typeof match === 'string') {
      return filePath.includes(match);
    } else if (match instanceof RegExp) {
      return match.test(filePath);
    }
    // default is do not filter when match is illegal, so return true
    return true;
  });
};

const doJSXIdentifierName = (name) => {
  if (name.name.endsWith('Fragment')) {
    return { stop: true };
  }
  return { stop: false };
};

const doJSXMemberExpressionName = (name) => {
  return doJSXIdentifierName(name.property);
};

const doJSXNamespacedNameName = (name) => {
  return doJSXIdentifierName(name.name);
};

const doJSXPathName = (name) => {
  const visitors = {
    JSXIdentifier: doJSXIdentifierName,
    JSXMemberExpression: doJSXMemberExpressionName,
    JSXNamespacedName: doJSXNamespacedNameName
  };

  return visitors[name.type](name);
};

const doJSXOpeningElement = (node, option) => {
  const { stop } = doJSXPathName(node.name);
  if (stop) return { stop };

  const { relativePath } = option;
  const line = node.loc?.start.line;
  const column = node.loc?.start.column;

  // const lineAttr = isNil(line)
  //   ? null
  //   : jsxAttribute(jsxIdentifier('data-inspector-line'), stringLiteral(line.toString()));

  // const columnAttr = isNil(column)
  //   ? null
  //   : jsxAttribute(jsxIdentifier('data-inspector-column'), stringLiteral(column.toString()));

  const relativePathAttr = jsxAttribute(
    jsxIdentifier('data-inspector-relative-path'),
    stringLiteral(
      relativePath.replace(/\\/g, '/') +
        (isNil(line) ? '' : ':' + line) +
        (isNil(line) || isNil(column) ? '' : ':' + column)
    )
  );

  const attributes = [relativePathAttr]; // [lineAttr, columnAttr, relativePathAttr];

  // Make sure that there are exist together
  if (attributes.every(Boolean)) {
    node.attributes.unshift(...attributes);
  }

  return { result: node };
};

const memo = (handler) => {
  const cache = new Map();
  return (arg) => {
    if (cache.has(arg)) {
      return cache.get(arg);
    }
    const result = handler(arg);
    cache.set(arg, result);
    return result;
  };
};

const createVisitor = ({ cwd, excludes }) => {
  const isExclude = excludes?.length
    ? memo((filePath) => pathMatch(filePath, excludes))
    : () => false;

  const pathRelative = memo((filePath) => relative(cwd ?? process.cwd(), filePath));

  const visitor = {
    JSXOpeningElement: {
      enter(path, state) {
        const filePath = state?.file?.opts?.filename;
        if (!filePath) return;
        if (isExclude(filePath)) return;

        const relativePath = pathRelative(filePath);

        doJSXOpeningElement(path.node, {
          relativePath
        });
      }
    }
  };

  return visitor;
};

function InspectorBabelPlugin(babel, options) {
  return {
    name: 'react-dev-inspector-babel-plugin',

    visitor: createVisitor({
      cwd: options?.cwd,
      excludes: ['node_modules/', ...(options?.excludes ?? [])]
    })
  };
}

export default InspectorBabelPlugin;
