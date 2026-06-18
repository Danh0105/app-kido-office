import HeaderWithBack from "@/components/HeaderWithBack";

import React, { useEffect, useRef, useState } from "react";

import { trainingApi } from "../../../../service/trainning";

import YouTube from "react-youtube";

interface TrainingItem {
  id: number;
  title: string;
  youtubeId: string;
}

interface ProgressMap {
  [key: number]: {
    percent: number;
    completed: boolean;
    watchedSeconds?: number;
  };
}

export default function Training() {
  const [trainings, setTrainings] = useState<TrainingItem[]>([]);

  const [progressMap, setProgressMap] = useState<ProgressMap>({});

  const watchedTimeRef = useRef<Record<number, number>>({});

  const durationRef = useRef<Record<number, number>>({});

  const lastTimeRef = useRef<Record<number, number>>({});

  const playerRefs = useRef<Record<number, any>>({});

  const saveTimeoutRef = useRef<Record<number, number>>({});

  // =========================
  // LOAD DATA
  // =========================

  const loadData = async () => {
    try {
      const [trainingRes, progressRes] = await Promise.all([
        trainingApi.findAll(),
        trainingApi.getMyProgress(),
      ]);

      setTrainings(trainingRes);

      const map: ProgressMap = {};

      progressRes.forEach((item: any) => {
        map[item.trainingId] = {
          percent: item.percent || 0,
          completed: item.completed || false,
          watchedSeconds: item.watchedSeconds || 0,
        };

        watchedTimeRef.current[item.trainingId] = item.watchedSeconds || 0;
      });

      setProgressMap(map);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // =========================
  // READY
  // =========================

  const handleReady = (id: number, event: any) => {
    const player = event.target;

    playerRefs.current[id] = player;

    const duration = player.getDuration();

    durationRef.current[id] = duration;

    const watched = watchedTimeRef.current[id] || 0;

    // RESUME VIDEO
    if (watched > 0) {
      player.seekTo(watched, true);

      lastTimeRef.current[id] = watched;
    } else {
      lastTimeRef.current[id] = 0;
    }

    // FORCE SPEED
    player.setPlaybackRate(1);
  };

  // =========================
  // SAVE PROGRESS
  // =========================

  const saveProgress = async (trainingId: number) => {
    try {
      const watched = watchedTimeRef.current[trainingId];

      const duration = durationRef.current[trainingId];

      const current = lastTimeRef.current[trainingId];

      await trainingApi.updateProgress({
        trainingId,
        watchedSeconds: watched,
        lastVideoSecond: current,
        duration,
      });
    } catch (error) {
      console.error(error);
    }
  };

  // =========================
  // TRACK VIDEO
  // =========================

  useEffect(() => {
    const interval = setInterval(() => {
      trainings.forEach((item) => {
        const player = playerRefs.current[item.id];

        if (!player) return;

        const state = player.getPlayerState();

        // PLAYING
        if (state !== 1) return;

        // TAB HIDDEN
        if (document.hidden) {
          player.pauseVideo();
          return;
        }

        const current = player.getCurrentTime();

        const last = lastTimeRef.current[item.id] || 0;

        // BLOCK SEEK
        if (current - last > 2) {
          player.seekTo(last, true);
          return;
        }

        // TRACK WATCH
        if (current > last) {
          watchedTimeRef.current[item.id] += current - last;
        }

        lastTimeRef.current[item.id] = current;

        const watched = watchedTimeRef.current[item.id];

        const duration = durationRef.current[item.id];

        const percent = Math.min(100, Math.floor((watched / duration) * 100));

        // UI UPDATE
        setProgressMap((prev) => ({
          ...prev,
          [item.id]: {
            percent,
            completed: percent >= 90,
            watchedSeconds: watched,
          },
        }));

        // SAVE EVERY 15S
        const currentSecond = Math.floor(current);

        if (
          currentSecond % 15 === 0 &&
          saveTimeoutRef.current[item.id] !== currentSecond
        ) {
          saveTimeoutRef.current[item.id] = currentSecond;

          saveProgress(item.id);
        }

        // AUTO COMPLETE SAVE
        if (percent >= 90) {
          saveProgress(item.id);
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [trainings]);

  // =========================
  // SAVE BEFORE EXIT
  // =========================

  useEffect(() => {
    const handleBeforeUnload = () => {
      trainings.forEach((item) => {
        saveProgress(item.id);
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [trainings]);

  return (
    <div className="min-h-screen bg-gray-100">
      <HeaderWithBack title="Training" />

      <div className="p-4 mt-[60px] space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold text-lg">Nội dung đào tạo</h2>

          <p className="text-sm text-gray-500 mt-2">
            Hoàn thành training để chuyển sang nhân viên chính thức.
          </p>
        </div>

        {trainings.map((item) => {
          const progress = progressMap[item.id];

          return (
            <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-3">
                <p className="font-semibold flex-1">{item.title}</p>

                {progress?.completed ? (
                  <span className="text-green-600 text-sm font-bold whitespace-nowrap">
                    Đã hoàn thành
                  </span>
                ) : (
                  <span className="text-orange-500 text-sm whitespace-nowrap">
                    {progress?.percent || 0}%
                  </span>
                )}
              </div>

              {/* PROGRESS */}
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{
                    width: `${progress?.percent || 0}%`,
                  }}
                />
              </div>

              {/* VIDEO */}
              <div className="overflow-hidden rounded-xl">
                <YouTube
                  videoId={item.youtubeId}
                  opts={{
                    width: "100%",
                    height: "220",
                    playerVars: {
                      controls: 1,
                      rel: 0,
                      modestbranding: 1,
                      disablekb: 1,
                    },
                  }}
                  onReady={(e) => handleReady(item.id, e)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
