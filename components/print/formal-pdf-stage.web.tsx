import { StyleSheet, View } from 'react-native';

type FormalPdfStageProps = {
  onError: (message: string) => void;
  onLoadComplete: (pages: number) => void;
  pageCount: number | null;
  uri: string;
};

const HtmlPdfFrame = 'iframe' as any;

export function FormalPdfStage({ onLoadComplete, uri }: FormalPdfStageProps) {
  return (
    <View style={styles.viewerShell}>
      <View style={styles.webFrameWrap}>
        <HtmlPdfFrame
          onLoad={() => onLoadComplete(1)}
          src={uri}
          style={styles.webFrame}
          title="正式 PDF 查看器"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewerShell: {
    flex: 1,
    minHeight: 640,
  },
  webFrame: {
    borderWidth: 0,
    flex: 1,
    height: 900,
    width: '100%',
  },
  webFrameWrap: {
    backgroundColor: '#DDE6F2',
    borderRadius: 26,
    flex: 1,
    minHeight: 680,
    overflow: 'hidden',
  },
});
