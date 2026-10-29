import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, Pressable, Platform } from "react-native";
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";
import { C } from "@/components/camporder/ui";

interface RiderLiveMapProps {
  vendorName?: string;
  deliveryAddress?: string;
  orderCode?: string;
  riderName?: string;
  riderPhone?: string;
  updatedAt?: string;
  etaMin?: number;
}

// Coordinate path on our campus vector map (0 to 360 x, 0 to 220 y)
const WAYPOINTS = [
  { x: 50, y: 170 },   // Start: Campus Kitchen / Vendor
  { x: 95, y: 155 },
  { x: 130, y: 110 },  // Central Campus roundabout
  { x: 180, y: 80 },   // Library junction
  { x: 240, y: 75 },   // Science quad
  { x: 290, y: 105 },  // Hall of Residence gate
  { x: 310, y: 140 },  // Dropoff point
];

function getPointAlongPath(progress: number) {
  // Clamp progress between 0 and 1
  const t = Math.max(0, Math.min(1, progress));
  const segments = WAYPOINTS.length - 1;
  const rawIndex = t * segments;
  const index = Math.min(Math.floor(rawIndex), segments - 1);
  const subT = rawIndex - index;

  const p0 = WAYPOINTS[index];
  const p1 = WAYPOINTS[index + 1];

  return {
    x: p0.x + (p1.x - p0.x) * subT,
    y: p0.y + (p1.y - p0.y) * subT,
  };
}

export function RiderLiveMap({
  vendorName = "Campus Kitchen",
  deliveryAddress = "Campus Hall / Room",
  orderCode = "ORD",
  riderName = "Kofi (Campus Courier)",
  riderPhone,
  updatedAt,
  etaMin = 15,
}: RiderLiveMapProps) {
  // Calculate initial progress based on elapsed time since order was marked 'on_the_way'
  const [progress, setProgress] = useState(0.25);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    // If updatedAt is provided, compute real progress based on etaMin
    const calculateInitialProgress = () => {
      if (!updatedAt) return 0.25;
      const started = new Date(updatedAt).getTime();
      const now = Date.now();
      const elapsedMin = Math.max(0, (now - started) / (1000 * 60));
      const totalMin = Math.max(5, etaMin);
      // Progress from 10% to 92%
      const calculated = Math.min(0.92, Math.max(0.12, (elapsedMin / totalMin) * 0.9 + 0.1));
      return calculated;
    };

    setProgress(calculateInitialProgress());

    // Advance rider gently every 3 seconds to show live movement
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 0.94) return 0.94;
        return prev + 0.015;
      });
      setPulse((p) => !p);
    }, 2800);

    return () => clearInterval(timer);
  }, [updatedAt, etaMin]);

  const riderPos = getPointAlongPath(progress);
  const remainingMinutes = Math.max(2, Math.round((1 - progress) * (etaMin || 15)));

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveBadgeText}>LIVE RIDER TRACKING</Text>
        </View>
        <Text style={styles.etaText}>~{remainingMinutes} min away</Text>
      </View>

      {/* Styled Interactive SVG Map Canvas */}
      <View style={styles.mapContainer}>
        <Svg width="100%" height={210} viewBox="0 0 360 210" style={styles.svgMap}>
          <Defs>
            <LinearGradient id="landGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#F5F9F6" />
              <Stop offset="100%" stopColor="#EBF4EE" />
            </LinearGradient>
            <LinearGradient id="routeGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor="#0D7048" />
              <Stop offset="100%" stopColor="#10B981" />
            </LinearGradient>
          </Defs>

          {/* Background Terrain */}
          <Rect x="0" y="0" width="360" height="210" fill="url(#landGrad)" />

          {/* Campus Greenery Zones / Fields */}
          <Rect x="15" y="15" width="80" height="60" rx="14" fill="#E2EDE5" />
          <Rect x="230" y="20" width="115" height="40" rx="12" fill="#E2EDE5" />
          <Rect x="135" y="145" width="100" height="50" rx="16" fill="#E2EDE5" />

          {/* Secondary Campus Streets */}
          <Path
            d="M 20 80 Q 80 85 140 100 T 260 120 T 340 120"
            stroke="#DEE7E1"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M 120 20 L 120 190"
            stroke="#DEE7E1"
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M 240 20 L 240 190"
            stroke="#DEE7E1"
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
          />

          {/* Active Delivery Route Line (Dashed underneath) */}
          <Path
            d={`M ${WAYPOINTS.map((p) => `${p.x} ${p.y}`).join(" L ")}`}
            stroke="#CBD5E1"
            strokeWidth="6"
            strokeDasharray="6,4"
            fill="none"
            strokeLinecap="round"
          />

          {/* Traveled Route Line */}
          <Path
            d={`M ${WAYPOINTS[0].x} ${WAYPOINTS[0].y} L ${riderPos.x} ${riderPos.y}`}
            stroke="url(#routeGrad)"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
          />

          {/* Start Marker: Kitchen */}
          <Circle cx={WAYPOINTS[0].x} cy={WAYPOINTS[0].y} r="14" fill="#F4A34F" />
          <Circle cx={WAYPOINTS[0].x} cy={WAYPOINTS[0].y} r="8" fill="#FFFFFF" />
          <SvgText
            x={WAYPOINTS[0].x}
            y={WAYPOINTS[0].y + 26}
            fontSize="10"
            fontWeight="bold"
            fill="#4B5563"
            textAnchor="middle"
          >
            Kitchen
          </SvgText>

          {/* Destination Marker: Student Residence */}
          <Circle cx={WAYPOINTS[WAYPOINTS.length - 1].x} cy={WAYPOINTS[WAYPOINTS.length - 1].y} r="14" fill="#18231D" />
          <Circle cx={WAYPOINTS[WAYPOINTS.length - 1].x} cy={WAYPOINTS[WAYPOINTS.length - 1].y} r="6" fill="#FFFFFF" />
          <SvgText
            x={WAYPOINTS[WAYPOINTS.length - 1].x}
            y={WAYPOINTS[WAYPOINTS.length - 1].y + 26}
            fontSize="10"
            fontWeight="bold"
            fill="#18231D"
            textAnchor="middle"
          >
            Delivery Point
          </SvgText>

          {/* Live Animated Rider Marker */}
          {/* Sonar wave pulse */}
          <Circle
            cx={riderPos.x}
            cy={riderPos.y}
            r={pulse ? "24" : "18"}
            fill="rgba(13, 112, 72, 0.22)"
          />
          {/* Main Rider Pin */}
          <Circle cx={riderPos.x} cy={riderPos.y} r="13" fill="#0D7048" />
          <Circle cx={riderPos.x} cy={riderPos.y} r="4" fill="#FFFFFF" />
          <SvgText
            x={riderPos.x}
            y={riderPos.y - 17}
            fontSize="11"
            fontWeight="900"
            fill="#0D7048"
            textAnchor="middle"
          >
            🛵 Rider
          </SvgText>
        </Svg>
      </View>

      {/* Rider & Delivery Info Strip */}
      <View style={styles.riderStrip}>
        <View style={styles.riderAvatar}>
          <Ionicons name="bicycle" size={20} color={C.green} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.riderName}>{riderName}</Text>
          <Text style={styles.riderSub} numberOfLines={1}>
            En route to: {deliveryAddress}
          </Text>
        </View>
        <View style={styles.speedBadge}>
          <Ionicons name="speedometer-outline" size={13} color={C.green} />
          <Text style={styles.speedText}>On route</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    gap: 12,
    marginVertical: 4,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#16A34A",
  },
  liveBadgeText: {
    color: "#15803D",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  etaText: {
    color: C.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  mapContainer: {
    borderRadius: 15,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F5F9F6",
  },
  svgMap: {
    width: "100%",
  },
  riderStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 4,
    borderTopWidth: 1,
    borderColor: C.border,
  },
  riderAvatar: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: C.sage,
    alignItems: "center",
    justifyContent: "center",
  },
  riderName: {
    color: C.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  riderSub: {
    color: C.muted,
    fontSize: 12,
    marginTop: 2,
  },
  speedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.sage,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  speedText: {
    color: C.green,
    fontSize: 11,
    fontWeight: "700",
  },
});
