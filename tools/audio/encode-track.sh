#!/usr/bin/env bash
#
# Encodes one radio track for public/music (src/features/music/stations.ts).
#
# Usage:
#   tools/audio/encode-track.sh <input> <output.mp3> [start] [end] [fade]
#
#   start  seconds to skip at the head, to drop a long fade-in (default 0).
#   end    seconds (of the source) where the track stops. When it cuts the
#          track before its own end, the last `fade` seconds fade out
#          (default 3), so it ends like a radio edit, on a phrase.
#   fade   length of that fade-out, in seconds (default 3).
#
# What it does, in order:
#   1. trims to [start, end] and fades out a mid-track cut;
#   2. strips leading and trailing near-silence (34 dB under the track's
#      loudness, so -50 dBFS once normalised; a lone click does not count),
#      so a playlist goes from one track to the next without a gap, with
#      50 ms fades at both edges against clicks;
#   3. normalises the loudness to -16 LUFS integrated, -1.5 dBTP true peak,
#      with ffmpeg's loudnorm in two passes (measure, then apply as one
#      linear gain). When that gain would push the peaks past the ceiling, a
#      transparent peak limiter goes first, so the gain stays linear instead
#      of loudnorm's pumping dynamic mode;
#   4. encodes MP3 128 kbps CBR, 44.1 kHz stereo, with every tag and
#      chapter stripped;
#   5. measures the result and prints one line: duration (the value for
#      stations.ts), integrated loudness and true peak.
#
# Needs ffmpeg with libmp3lame, on PATH or named by the FFMPEG environment
# variable. Without a system ffmpeg, `pip install imageio-ffmpeg` ships one:
#   FFMPEG=$(python -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())")
#
# Example (the first K-CALIMA track):
#   tools/audio/encode-track.sh ~/Downloads/classic.mp3 public/music/classic.mp3 0 149.4
set -euo pipefail

FFMPEG=${FFMPEG:-ffmpeg}
TARGET_I=-16
TARGET_TP=-1.5
# MP3 encoding adds a few tenths of a dB of inter-sample overshoot: the PCM
# aims half a dB under the ceiling, so the MP3 lands under it.
PCM_TP=-2.0
# Near-silence, relative to the track's own loudness: -50 dBFS once it is at
# -16 LUFS, whatever level the source was mastered at.
SILENCE_BELOW_I=34
EDGE=0.05

usage() {
  sed -n '3,12p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit 2
}

[ $# -ge 2 ] && [ $# -le 5 ] || usage
input=$1
output=$2
start=${3:-0}
end=${4:-}
fade=${5:-3}

command -v "$FFMPEG" >/dev/null 2>&1 || {
  echo "encode-track: ffmpeg not found; put it on PATH or set FFMPEG" >&2
  exit 1
}
[ -f "$input" ] || {
  echo "encode-track: no such file: $input" >&2
  exit 1
}

ff() { "$FFMPEG" -hide_banner -nostdin -nostats "$@"; }

# awk does the arithmetic (bash has integers only).
calc() { awk "BEGIN { printf \"%.4f\", $1 }"; }
less_than() { awk "BEGIN { exit !($1 < $2) }"; }

# Value of one key in the JSON loudnorm prints at the end of a pass.
json_value() { grep -o "\"$1\" : \"[^\"]*\"" | tail -1 | sed 's/.*: "\(.*\)"/\1/'; }

# Without an output, ffmpeg prints the input's header and exits with an error.
source_seconds=$({ ff -i "$input" 2>&1 || true; } | sed -n 's/.*Duration: \([0-9]*\):\([0-9]*\):\([0-9.]*\).*/\1 \2 \3/p' | head -1 |
  awk '{ printf "%.3f", $1 * 3600 + $2 * 60 + $3 }')

# 1. Trim, and fade out a cut before the source's own end.
chain="atrim=start=${start}"
if [ -n "$end" ] && less_than "$end" "$(calc "$source_seconds - 0.05")"; then
  length=$(calc "$end - $start")
  chain="${chain}:end=${end},asetpts=PTS-STARTPTS,afade=t=out:st=$(calc "$length - $fade"):d=${fade}"
else
  chain="${chain},asetpts=PTS-STARTPTS"
fi

# 2. No silence at either end, and no click where the edges were cut. Sound
# must last 0.1 s to count, so a click before the first note is trimmed too.
# `measure` runs a chain through loudnorm and prints its report.
measure() {
  ff -i "$input" -map 0:a:0 -af "$1,loudnorm=I=${TARGET_I}:TP=${PCM_TP}:LRA=11:print_format=json" -f null - 2>&1
}
source_i=$(measure "$chain" | json_value input_i)
silence=$(calc "$source_i - $SILENCE_BELOW_I")
strip="silenceremove=start_periods=1:start_threshold=${silence}dB:start_duration=0.1:start_silence=${EDGE}:detection=rms"
chain="${chain},${strip},areverse,${strip},afade=t=in:d=${EDGE},areverse,afade=t=in:d=${EDGE}"

# 3 to 5, for a ceiling on the PCM: measure, limit if needed, apply the
# gain, encode, then measure what a listener gets. Sets mode, lufs, peak and
# seconds.
plain=$chain
encode() {
  local pcm_tp=$1 chain=$plain report input_i input_tp input_lra input_thresh offset gain lra ceiling applied check samples
  # Pass 1: measure.
  report=$(measure "$chain")
  input_i=$(json_value input_i <<<"$report")
  input_tp=$(json_value input_tp <<<"$report")
  gain=$(calc "$TARGET_I - ($input_i)")

  # A gain that lifts the peaks past the ceiling: limit them first, then
  # measure again. The limiter takes a little loudness off, so the gain
  # grows: lower the limit until gain and peaks fit together.
  for _ in 1 2 3 4 5; do
    less_than "$pcm_tp" "$(calc "$input_tp + $gain")" || break
    ceiling=$(calc "10 ^ (($pcm_tp - $gain - 0.3) / 20)")
    chain="${plain},alimiter=limit=${ceiling}:attack=5:release=60:level=false"
    report=$(measure "$chain")
    input_i=$(json_value input_i <<<"$report")
    input_tp=$(json_value input_tp <<<"$report")
    gain=$(calc "$TARGET_I - ($input_i)")
  done

  input_lra=$(json_value input_lra <<<"$report")
  input_thresh=$(json_value input_thresh <<<"$report")
  offset=$(json_value target_offset <<<"$report")
  # loudnorm only stays linear when the target range covers the track's own.
  lra=$(awk "BEGIN { v = $input_lra + 1; if (v < 11) v = 11; if (v > 50) v = 50; printf \"%.1f\", v }")

  # Pass 2: apply as one gain, encode, strip every tag.
  mkdir -p "$(dirname "$output")"
  applied=$(ff -y -i "$input" -map 0:a:0 \
    -af "${chain},loudnorm=I=${TARGET_I}:TP=${pcm_tp}:LRA=${lra}:measured_I=${input_i}:measured_TP=${input_tp}:measured_LRA=${input_lra}:measured_thresh=${input_thresh}:offset=${offset}:linear=true:print_format=json" \
    -ar 44100 -ac 2 -c:a libmp3lame -b:a 128k \
    -map_metadata -1 -map_chapters -1 -id3v2_version 0 -write_id3v1 0 \
    -fflags +bitexact -flags:a +bitexact \
    "$output" 2>&1)
  mode=$(json_value normalization_type <<<"$applied")

  check=$(ff -i "$output" -af "ebur128=peak=true,astats=measure_perchannel=none:measure_overall=Number_of_samples" -f null - 2>&1)
  lufs=$(sed -n 's/^ *I: *\(-\{0,1\}[0-9.]*\) LUFS.*/\1/p' <<<"$check" | tail -1)
  peak=$(sed -n '/True peak:/,/Peak:/s/^ *Peak: *\(-\{0,1\}[0-9.]*\) dBFS.*/\1/p' <<<"$check" | tail -1)
  samples=$(sed -n 's/.*Number of samples: *\([0-9]*\).*/\1/p' <<<"$check" | tail -1)
  seconds=$(awk "BEGIN { printf \"%.2f\", $samples / 44100 }")
}

# Some masters overshoot more than the headroom in the MP3: lower the PCM
# ceiling by what went over and encode again.
pcm_tp=$PCM_TP
for _ in 1 2 3; do
  encode "$pcm_tp"
  less_than "$TARGET_TP" "$peak" || break
  pcm_tp=$(calc "$pcm_tp - ($peak - ($TARGET_TP)) - 0.2")
done

printf '%s: %s s, %s LUFS, %s dBTP, %s gain\n' "$(basename "$output")" "$seconds" "$lufs" "$peak" "$mode"
if ! awk "BEGIN { exit !($lufs >= $TARGET_I - 1 && $lufs <= $TARGET_I + 1 && $peak <= $TARGET_TP) }"; then
  echo "encode-track: warning: off target (${TARGET_I} LUFS +-1, ${TARGET_TP} dBTP at most)" >&2
fi
