let session = null;
let vocab = null;
let initPromise = null;

const LABEL_MAP = {
  'LABEL_0': 'essential',
  'LABEL_1': 'functional',
  'LABEL_2': 'analytics',
  'LABEL_3': 'marketing',
  'LABEL_4': 'unknown'
};

async function initONNX() {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      console.log('Starting ONNX initialization...');
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.wasmPaths = chrome.runtime.getURL('onnx-files/');

      const vocabPath = chrome.runtime.getURL('quantized_model/vocab.txt');
      const vocabResponse = await fetch(vocabPath);
      const vocabText = await vocabResponse.text();
      vocab = vocabText.split('\n').reduce((acc, token, idx) => {
        const trimmed = token.trim();
        if (trimmed) {
          acc[trimmed] = idx;
        }
        return acc;
      }, {});
      console.log('Vocab loaded, size:', Object.keys(vocab).length);

      const modelPath = chrome.runtime.getURL('quantized_model/model_quantized.onnx');
      console.log('Loading model from:', modelPath);
      session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['wasm']
      });

      console.log('ONNX Runtime initialized successfully');
    } catch (error) {
      console.error('Error initializing ONNX Runtime:', error);
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

function tokenize(text, maxLength = 512) {
  const tokens = ['[CLS]'];
  const words = text.toLowerCase().split(/\s+/);

  for (const word of words) {
    if (vocab[word] !== undefined) {
      tokens.push(word);
    } else {
      for (let i = 0; i < word.length; i++) {
        const char = word[i];
        tokens.push(vocab[char] !== undefined ? char : '[UNK]');
      }
    }

    if (tokens.length >= maxLength - 1) break;
  }

  tokens.push('[SEP]');

  const inputIds = tokens.map(token => vocab[token] ?? vocab['[UNK]']);
  const attentionMask = new Array(inputIds.length).fill(1);

  while (inputIds.length < maxLength) {
    inputIds.push(vocab['[PAD]']);
    attentionMask.push(0);
  }

  return {
    input_ids: inputIds.slice(0, maxLength),
    attention_mask: attentionMask.slice(0, maxLength)
  };
}

async function classifyCookie(cookieName) {
  try {
    if (!session || !vocab) {
      await initONNX();
    }

    if (!vocab || !session) {
      console.error('Model not ready');
      return 'unknown';
    }

    const { input_ids, attention_mask } = tokenize(cookieName);

    const inputIdsTensor = new ort.Tensor('int64', BigInt64Array.from(input_ids.map(x => BigInt(x))), [1, input_ids.length]);
    const attentionMaskTensor = new ort.Tensor('int64', BigInt64Array.from(attention_mask.map(x => BigInt(x))), [1, attention_mask.length]);

    const feeds = {
      input_ids: inputIdsTensor,
      attention_mask: attentionMaskTensor
    };

    const results = await session.run(feeds);
    const logits = results.logits.data;

    let maxIdx = 0;
    let maxVal = logits[0];
    const allScores = [];

    for (let i = 0; i < logits.length; i++) {
      allScores.push({ label: LABEL_MAP[`LABEL_${i}`], score: logits[i].toFixed(4) });
      if (logits[i] > maxVal) {
        maxVal = logits[i];
        maxIdx = i;
      }
    }

    const label = `LABEL_${maxIdx}`;
    const category = LABEL_MAP[label] || 'unknown';

    console.log(`%c[Model Inference] "${cookieName}"`, 'color: #9C27B0', '\nScores:', allScores, `\nPredicted: ${category} (score: ${maxVal.toFixed(4)})`);

    return category;
  } catch (error) {
    console.error('Error classifying cookie:', cookieName, error);
    return 'unknown';
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CLASSIFY_COOKIE') {
    classifyCookie(message.cookieName).then(category => {
      sendResponse({ category });
    });
    return true;
  }
});

initONNX();
