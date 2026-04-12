import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

type Phase = 'edit' | 'blocked' | 'done';

type Task = {
  id: string;
  title: string;
};

const TITLE_HISTORY_KEY = 'yarubekikoto_title_history_v1';
const MAX_TITLE_HISTORY = 50;

/** タスク帯ごとに画面を覆うグラデーション（インデックスで循環） */
const SEGMENT_GRADIENTS: readonly [string, string][] = [
  ['#6c5ce7', '#a29bfe'],
  ['#e17055', '#fdcb6e'],
  ['#00b894', '#55efc4'],
  ['#0984e3', '#74b9ff'],
  ['#d63031', '#ff7675'],
  ['#fd79a8', '#e84393'],
  ['#a29bfe', '#6c5ce7'],
  ['#fab1a0', '#ff7675'],
];

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function AppContent() {
  const [phase, setPhase] = useState<Phase>('edit');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [draftTitle, setDraftTitle] = useState('');
  const [titleHistory, setTitleHistory] = useState<string[]>([]);
  /** 集中モードで項目ごとに「完了」したら true */
  const [confirmations, setConfirmations] = useState<Record<string, boolean>>(
    {}
  );

  const total = tasks.length;

  const segments = useMemo(() => {
    if (total === 0) return [];
    return tasks.map((task, index) => ({
      task,
      index,
      topPct: (index / total) * 100,
      heightPct: 100 / total,
    }));
  }, [tasks, total]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(TITLE_HISTORY_KEY);
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          setTitleHistory(
            parsed.filter((x): x is string => typeof x === 'string')
          );
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pushTitleHistory = useCallback((title: string) => {
    setTitleHistory((prev) => {
      const next = [title, ...prev.filter((t) => t !== title)].slice(
        0,
        MAX_TITLE_HISTORY
      );
      AsyncStorage.setItem(TITLE_HISTORY_KEY, JSON.stringify(next)).catch(
        () => {}
      );
      return next;
    });
  }, []);

  useEffect(() => {
    if (phase !== 'blocked' || total === 0) return;
    const allConfirmed = tasks.every((t) => confirmations[t.id] === true);
    if (allConfirmed) {
      setPhase('done');
    }
  }, [phase, tasks, total, confirmations]);

  const addTask = useCallback(() => {
    const title = draftTitle.trim();
    if (!title) return;
    setTasks((prev) => [...prev, { id: newId(), title }]);
    pushTitleHistory(title);
    setDraftTitle('');
  }, [draftTitle, pushTitleHistory]);

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const startBlock = useCallback(() => {
    if (tasks.length === 0) return;
    const init: Record<string, boolean> = {};
    tasks.forEach((t) => {
      init[t.id] = false;
    });
    setConfirmations(init);
    setPhase('blocked');
  }, [tasks]);

  const confirmPanel = useCallback((id: string) => {
    setConfirmations((prev) => ({ ...prev, [id]: true }));
  }, []);

  const historyChips = useMemo(() => {
    const q = draftTitle.trim().toLowerCase();
    if (!q) return titleHistory.slice(0, 16);
    return titleHistory
      .filter((t) => t.toLowerCase().includes(q))
      .slice(0, 16);
  }, [draftTitle, titleHistory]);

  const backToEdit = useCallback(() => {
    setPhase('edit');
    setConfirmations({});
  }, []);

  if (phase === 'blocked') {
    return (
      <View style={styles.blockRoot}>
        <StatusBar hidden />
        {segments.map(({ task, index, topPct, heightPct }) => {
          if (confirmations[task.id] === true) return null;
          const [c0, c1] = SEGMENT_GRADIENTS[index % SEGMENT_GRADIENTS.length];
          return (
            <View
              key={task.id}
              style={[
                styles.panel,
                {
                  top: `${topPct}%`,
                  height: `${heightPct}%`,
                },
              ]}
            >
              <LinearGradient
                colors={[c0, c1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`完了: ${task.title}`}
                onPress={() => confirmPanel(task.id)}
                style={({ pressed }) => [
                  styles.panelPress,
                  pressed && styles.panelPressPressed,
                ]}
              >
                <Text style={styles.panelTitle}>{task.title}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    );
  }

  if (phase === 'done') {
    return (
      <LinearGradient
        colors={['#dfe6e9', '#b2bec3']}
        style={styles.doneRoot}
      >
        <StatusBar style="dark" />
        <SafeAreaView style={styles.doneInner}>
          <Text style={styles.doneTitle}>すべて完了</Text>
          <Text style={styles.doneBody}>
            パネルをすべて外しました。スマホを使って大丈夫です。
          </Text>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
            onPress={backToEdit}
          >
            <Text style={styles.primaryBtnText}>やるべきことリストに戻る</Text>
          </Pressable>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#f8f9fa', '#dee2e6']} style={styles.editRoot}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.editInner} edges={['top', 'left', 'right']}>
        <Text style={styles.editHeading}>やるべきこと</Text>
        <Text style={styles.editSub}>
          完了するまで画面がカラフルなパネルで覆われます。項目をタップするとその帯だけ外れ、下の画面が見えます。
        </Text>

        <TextInput
          value={draftTitle}
          onChangeText={setDraftTitle}
          placeholder="やるべきこと（項目）"
          placeholderTextColor="#adb5bd"
          style={[styles.input, styles.inputStacked]}
          onSubmitEditing={addTask}
          returnKeyType="done"
        />
        {historyChips.length > 0 ? (
          <View style={styles.historyBlock}>
            <Text style={styles.historyLabel}>以前入力した項目</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {historyChips.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setDraftTitle(t)}
                  style={({ pressed }) => [
                    styles.chip,
                    pressed && styles.chipPressed,
                  ]}
                >
                  <Text style={styles.chipText} numberOfLines={1}>
                    {t}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <Pressable
          hitSlop={{ top: 6, bottom: 10 }}
          style={({ pressed }) => [styles.addBtn, styles.addBtnFull, pressed && styles.btnPressed]}
          onPress={addTask}
        >
          <Text style={styles.addBtnText}>項目を追加</Text>
        </Pressable>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {tasks.length === 0 ? (
            <Text style={styles.empty}>
              まだ項目がありません。やるべきことを入力して追加してください。
            </Text>
          ) : (
            tasks.map((t) => (
              <View key={t.id} style={styles.listRow}>
                <View style={styles.listTextBlock}>
                  <Text style={styles.listText} numberOfLines={2}>
                    {t.title}
                  </Text>
                </View>
                <Pressable
                  hitSlop={8}
                  onPress={() => removeTask(t.id)}
                  style={({ pressed }) => [styles.deleteBtn, pressed && styles.btnPressed]}
                >
                  <Text style={styles.deleteBtnText}>削除</Text>
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>

        <Pressable
          style={({ pressed }) => [
            styles.startBtn,
            tasks.length === 0 && styles.startBtnDisabled,
            pressed && tasks.length > 0 && styles.btnPressed,
          ]}
          onPress={startBlock}
          disabled={tasks.length === 0}
        >
          <Text
            style={[
              styles.startBtnText,
              tasks.length === 0 && styles.startBtnTextDisabled,
            ]}
          >
            画面を覆って集中する
          </Text>
        </Pressable>
      </SafeAreaView>
    </LinearGradient>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  editRoot: {
    flex: 1,
  },
  editInner: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  editHeading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 8,
  },
  editSub: {
    fontSize: 14,
    lineHeight: 20,
    color: '#495057',
    marginBottom: 16,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ced4da',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#212529',
  },
  inputStacked: {
    marginBottom: 10,
  },
  historyBlock: {
    marginBottom: 12,
  },
  historyLabel: {
    fontSize: 12,
    color: '#868e96',
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 4,
  },
  chip: {
    maxWidth: 220,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ced4da',
  },
  chipPressed: {
    opacity: 0.88,
  },
  chipText: {
    fontSize: 14,
    color: '#212529',
  },
  addBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 22,
    minHeight: 54,
    borderRadius: 12,
    backgroundColor: '#212529',
  },
  addBtnFull: {
    width: '100%',
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 17,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 12,
  },
  empty: {
    color: '#868e96',
    fontSize: 14,
    lineHeight: 20,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ced4da',
    gap: 12,
  },
  listTextBlock: {
    flex: 1,
  },
  listText: {
    fontSize: 16,
    color: '#212529',
  },
  deleteBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  deleteBtnText: {
    color: '#c92a2a',
    fontWeight: '600',
    fontSize: 14,
  },
  startBtn: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#212529',
    alignItems: 'center',
  },
  startBtnDisabled: {
    backgroundColor: '#adb5bd',
  },
  startBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  startBtnTextDisabled: {
    color: '#e9ecef',
  },
  btnPressed: {
    opacity: 0.85,
  },

  blockRoot: {
    flex: 1,
    backgroundColor: '#111',
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  panelPress: {
    flex: 1,
    zIndex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  panelPressPressed: {
    opacity: 0.92,
  },
  panelTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  doneRoot: {
    flex: 1,
  },
  doneInner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  doneTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 12,
    textAlign: 'center',
  },
  doneBody: {
    fontSize: 16,
    lineHeight: 24,
    color: '#495057',
    textAlign: 'center',
    marginBottom: 28,
  },
  primaryBtn: {
    alignSelf: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#212529',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
