import { ArgsSyntax, StatementSyntax } from 'glimmer-runtime';
import { ConstReference, isConst, UNDEFINED_REFERENCE } from 'glimmer-reference';

// ⬇️ {{component source ...extra args}}
function dynamicComponentFor(vm) {
  let env    = vm.env;
  let args   = vm.getArgs();
  let source = args.positional.at(0);

  if (isConst(source)) {
    let name = source.value();
    let definition = env.getComponentDefinition([name]);
    return new ConstReference(definition);
  } else if (isComponentDefinitionReference(source)) {
    return source;
  } else {
    return new DynamicComponentReference({ source, env });
  }
}

export class DynamicComponentSyntax extends StatementSyntax {
  constructor({ args, templates }) {
    super();
    this.definitionArgs = ArgsSyntax.fromPositionalArgs(args.positional.slice(0, 1));
    this.definition = dynamicComponentFor;
    this.args = ArgsSyntax.build(args.positional.slice(1), args.named);
    this.templates = templates;
    this.shadow = null;
  }

  compile(builder) {
    builder.component.dynamic(this);
  }
}

export const COMPONENT_DEFINITION_REFERENCE = symbol('COMPONENT_DEFINITION_REFERENCE');

function isComponentDefinitionReference(ref) {
  return ref && ref[COMPONENT_DEFINITION_REFERENCE];
}

class DynamicComponentReference {
  constructor({ nameRef, env }) {
    this.nameRef = nameRef;
    this.env = env;
    this.tag = nameRef.tag;
    this[COMPONENT_DEFINITION_REFERENCE] = true;
  }

  value() {
    let { env, nameRef } = this;
    let name = nameRef.value();

    if (typeof name === 'string') {
      let definition = env.getComponentDefinition([name]);
      return definition;
    } else {
      return null;
    }
  }

  get() {
    return UNDEFINED_REFERENCE;
  }
}
