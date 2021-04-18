import path from 'path'
import {compile} from '../index.js'
import {promises as fs} from 'fs'
import test from 'tape'
import {transformAsync as babel} from '@babel/core'
import vue from 'vue'
import {renderToString} from '@vue/server-renderer'

test('xdm (vue)', async function (t) {
  var base = path.resolve(path.join('test', 'context'))

  var jsx = String(
    await compile(
      'export const C = () => <>c</>\n\n*a*, **b**, <C />, and <D />',
      {jsx: true}
    )
  )

  var js = (await babel(jsx, {plugins: ['@vue/babel-plugin-jsx']})).code

  // Vue used to be ESM, but it recently published a minor/patch w/o that.
  js = js.replace(
    /import {[^}]+} from "vue";/,
    'import vue from "vue"; const {isVNode: _isVNode, createVNode: _createVNode, createTextVNode: _createTextVNode, Fragment: _Fragment} = vue'
  )

  await fs.writeFile(path.join(base, 'vue.js'), js)

  var Content = /** @type {import('vue').Component} */ (
    /* @ts-ignore file is dynamically generated */
    (await import('./context/vue.js')).default // type-coverage:ignore-line
  )

  var result = await renderToString(
    vue.createSSRApp({
      // App components.
      components: {Content},
      template: '<Content :components="mdxComponents" />',
      data() {
        return {
          mdxComponents: {
            em: /**
             * @param {unknown} _
             * @param {import('vue').SetupContext} context
             * */ (_, context) => vue.h('i', context.attrs, context.slots),
            D: () => '<3'
          }
        }
      }
    })
  )

  t.equal(
    // Remove SSR comments used to hydrate (I guess).
    result.replace(/<!--[[\]]-->/g, ''),
    '<p><i>a</i>, <strong>b</strong>, c, and &lt;3</p>',
    'should compile'
  )

  await fs.unlink(path.join(base, 'vue.js'))

  t.end()
})
