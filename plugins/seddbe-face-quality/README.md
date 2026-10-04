# seddbe-facequality

Plugin para validar calida de la imagenes

## Install

To use npm

```bash
npm install seddbe-facequality
````

To use yarn

```bash
yarn add seddbe-facequality
```

Sync native files

```bash
npx cap sync
```

## API

<docgen-index>

* [`check(...)`](#check)
* [Interfaces](#interfaces)

</docgen-index>

<docgen-api>
<!--Update the source file JSDoc comments and rerun docgen to update the docs below-->

### check(...)

```typescript
check(options: FaceQualityCheckOptions) => Promise<FaceQualityCheckResult>
```

| Param         | Type                                                                        |
| ------------- | --------------------------------------------------------------------------- |
| **`options`** | <code><a href="#facequalitycheckoptions">FaceQualityCheckOptions</a></code> |

**Returns:** <code>Promise&lt;<a href="#facequalitycheckresult">FaceQualityCheckResult</a>&gt;</code>

--------------------


### Interfaces


#### FaceQualityCheckResult

| Prop           | Type                 |
| -------------- | -------------------- |
| **`valid`**    | <code>boolean</code> |
| **`faces`**    | <code>number</code>  |
| **`eyesOpen`** | <code>boolean</code> |
| **`message`**  | <code>string</code>  |


#### FaceQualityCheckOptions

| Prop                | Type                 | Description                                                                 |
| ------------------- | -------------------- | --------------------------------------------------------------------------- |
| **`image`**         | <code>string</code>  | Imagen en base64. En la app se envía `result.value` desde CameraPreview.    |
| **`isLivePreview`** | <code>boolean</code> | True cuando se valida en tiempo real (overlay). Permite respuestas rápidas. |

</docgen-api>
