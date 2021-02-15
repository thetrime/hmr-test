## Demonstration of HMR problem

The issue is that if you include react-refresh in the main bundle, but exclude react-dom and load it explicitly in a <script> tag, then react-dom will (probably) be loaded first.

If react-refresh is loaded first, then it looks for `__REACT_DEVTOOLS_GLOBAL_HOOK__`, and if it doesn't find one, it installs its own 'fake' devtools when `injectIntoGlobalHook(globalObject)` is called. See:

```
function injectIntoGlobalHook(globalObject) {
  {
    // For React Native, the global hook will be set up by require('react-devtools-core').
    // That code will run before us. So we need to monkeypatch functions on existing hook.
    // For React Web, the global hook will be set up by the extension.
    // This will also run before us.
    var hook = globalObject.__REACT_DEVTOOLS_GLOBAL_HOOK__;

    if (hook === undefined) {
      // However, if there is no DevTools extension, we'll need to set up the global hook ourselves.
      // Note that in this case it's important that renderer code runs *after* this method call.
      // Otherwise, the renderer will think that there is no global hook, and won't do the injection.
      var nextID = 0;
      globalObject.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook = {
        renderers: new Map(),
        supportsFiber: true,
        inject: function (injected) {
          return nextID++;
        },
        onScheduleFiberRoot: function (id, root, children) {},
        onCommitFiberRoot: function (id, root, maybePriorityLevel, didError) {},
        onCommitFiberUnmount: function () {}
      };
    } // Here, we just want to get a reference to scheduleRefresh.
```

When loading react-dom, on the other hand, the code checks `__REACT_DEVTOOLS_GLOBAL_HOOK__` when `injectInternals(internals)` is called, and if it is not defined, then we immediately exit.

```
var isDevToolsPresent = typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined';
function injectInternals(internals) {
  if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === 'undefined') {
    // No DevTools
    return false;
  }

  var hook = __REACT_DEVTOOLS_GLOBAL_HOOK__;

```

This means that injectedHook is never set to a value other than null, and so when we call `onCommitRoot(...)`:
```
function onCommitRoot(root, priorityLevel) {
  if (injectedHook && typeof injectedHook.onCommitFiberRoot === 'function') {
    try {
      var didError = (root.current.flags & DidCapture) === DidCapture;

      if (enableProfilerTimer) {
        injectedHook.onCommitFiberRoot(rendererID, root, priorityLevel, didError);
      } else {
        injectedHook.onCommitFiberRoot(rendererID, root, undefined, didError);
      }
    } catch (err) {
      {
        if (!hasLoggedError) {
          hasLoggedError = true;

          error('React instrumentation encountered an error: %s', err);
        }
      }
    }
  }
}
```
the code does nothing.

So, if we load react-dom first, then when we come to define the (fake) devtools in the react-refresh intialization code, it's already too late - the `onCommitFiberRoot()` function never gets called. As a reuslt, we never add the root to the mountedRoots variable (it always remains an empty set).

However, we *do* install the (fake) hook. That means we do all the other stuff related to HMR, and it works - we get the updates via websocket and XHR, and then try to apply them by calling performReactRefresh(), but since mountedRoots is forever empty, the thing that would actually _apply_ the change, specifically:
```
    mountedRootsSnapshot.forEach(function (root) {
      var helpers = helpersByRootSnapshot.get(root);

      if (helpers === undefined) {
        throw new Error('Could not find helpers for a root. This is a bug in React Refresh.');
      }

      if (!mountedRoots.has(root)) {// No longer mounted.
      }

      try {
        helpers.scheduleRefresh(root, update);
      } catch (err) {
        if (!didError) {
          didError = true;
          firstError = err;
        } // Keep trying other roots.

      }
    });
```
operates on an empty set.
